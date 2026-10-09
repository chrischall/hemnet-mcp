/**
 * Default Hemnet transport: a direct Node `fetch` to
 * `https://www.hemnet.se/graphql`.
 *
 * Hemnet serves the read queries anonymously — no bearer, cookie, or
 * CSRF token — so unlike the fetchproxy fleet members this needs no
 * browser session and no optional peer deps. It stays deliberately thin:
 * POST the operation, retry a couple of times on 429 / 5xx / network
 * blips with jittered exponential backoff (honouring a capped
 * `Retry-After`), parse the JSON envelope. Everything Hemnet-semantic
 * (GraphQL-error classification, empty-node handling) lives on the client.
 *
 * There are no secrets in play here, so — unlike the bearer clients in
 * @chrischall/mcp-utils — nothing needs redaction. A descriptive
 * User-Agent identifies the client honestly rather than impersonating a
 * browser.
 */
import {
  EdgeBlockedError,
  detectEdgeBlock,
  parseRetryAfterMs,
} from '@chrischall/mcp-utils';
import type {
  GraphQLResponse,
  HemnetTransport,
  TransportStatus,
} from './transport.js';

const GRAPHQL_ENDPOINT = 'https://www.hemnet.se/graphql';

export interface DirectTransportOptions {
  /** Override the endpoint (tests / self-host). Defaults to hemnet.se. */
  endpoint?: string;
  /** Per-request timeout in ms. Default 20000. */
  timeoutMs?: number;
  /** Retry attempts on 429/5xx/network error. Default 2 (3 tries total). */
  maxRetries?: number;
  /** Client version, surfaced in the User-Agent. */
  version?: string;
  /** Injected fetch (tests). Defaults to global `fetch`. */
  fetchImpl?: typeof fetch;
  /**
   * Cap on an honoured `Retry-After` wait, in ms. Default 10000 — long
   * enough to respect a soft rate limit, short enough not to pin a tool
   * call open.
   */
  maxRetryAfterMs?: number;
  /** Injected sleep (tests). Defaults to a `setTimeout` promise. */
  sleep?: (ms: number) => Promise<void>;
  /** Injected random source in [0,1) for jitter (tests). Defaults to `Math.random`. */
  random?: () => number;
}

const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);

/** Backoff window before the first retry; doubles per retry (1s, 2s, …). */
const BASE_BACKOFF_MS = 1000;

/** Sleep helper — extracted so it's obvious in a backoff loop. */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * A non-retryable HTTP failure (a 4xx other than 429, or a 2xx that isn't
 * JSON). Thrown from inside the retry loop's `try` so the `catch` can tell
 * it apart from a retryable network/abort error and propagate it
 * immediately.
 */
class HardHttpError extends Error {}

/**
 * Hemnet's CDN/WAF refused the request instead of answering GraphQL —
 * observed live 2026-07-13: the whole www.hemnet.se zone (including
 * `/graphql`) serves a Cloudflare managed challenge (`cf-mitigated:
 * challenge`, `_cf_chl_opt` interstitial) to non-browser clients regardless
 * of headers; only a real browser session clears it.
 *
 * It IS the shared `EdgeBlockedError` (fleet-audit#1020), so
 * `createDirectFirstTransport` falls back to the browser bridge on it and the
 * shared healthcheck reads its vendor, while keeping this repo's diagnostic
 * message (status, `server` / `cf-ray` / `cf-mitigated`). The class name is
 * kept for library consumers and for `hemnet_healthcheck`'s
 * `cloudflare_challenge` kind.
 */
export class CloudflareChallengeError extends EdgeBlockedError {
  constructor(message: string, status = 403, vendor = 'Cloudflare') {
    super(status, vendor, { service: 'Hemnet', method: 'POST', path: '/graphql' });
    this.name = 'CloudflareChallengeError';
    this.message = message;
  }
}

/** Read the body for diagnostics; best-effort (the status alone still tells the story). */
async function readBodySafely(res: Response): Promise<string> {
  try {
    return await res.text();
  } catch {
    return '';
  }
}

/** `server` / `cf-ray` / `cf-mitigated` headers, for error messages. */
function diagnostics(res: Response): string {
  return ['server', 'cf-ray', 'cf-mitigated']
    .map((name) => ({ name, value: res.headers.get(name) }))
    .filter((h) => h.value)
    .map((h) => `${h.name}: ${h.value}`)
    .join('; ');
}

/**
 * The challenge error for a response the shared `detectEdgeBlock` judges to
 * be a CDN/WAF refusal (the `cf-mitigated` header, or a vendor's page
 * markers — Cloudflare's challenge markers at ANY status, since Cloudflare
 * serves rate-limit blocks as 429 and the legacy JS challenge as 503), or
 * `undefined` when it isn't one.
 */
function edgeBlockError(res: Response, body: string): CloudflareChallengeError | undefined {
  const edge = detectEdgeBlock({ body, headers: res.headers, status: res.status });
  if (!edge) return undefined;
  const diag = diagnostics(res);
  return new CloudflareChallengeError(
    `Hemnet GraphQL HTTP ${res.status} — ${edge.vendor} bot challenge` +
      `${diag ? ` (${diag})` : ''}. Hemnet challenges non-browser clients; ` +
      'requests must ride a real browser session (ContextMint Bridge).',
    res.status,
    edge.vendor,
  );
}

/**
 * The diagnostic error for a non-retryable HTTP failure: status, the
 * diagnostic headers when present, and the first ~200 chars of the body —
 * a bare "HTTP 403" hides which failure mode (bot wall vs. moved endpoint
 * vs. bad request) you're in.
 */
function hardHttpError(res: Response, bodyHead: string): HardHttpError {
  const diag = diagnostics(res);
  return new HardHttpError(
    `Hemnet GraphQL HTTP ${res.status}${diag ? ` (${diag})` : ''}` +
      `${bodyHead ? ` — body starts: ${bodyHead}` : ''}`,
  );
}

export class DirectTransport implements HemnetTransport {
  private readonly endpoint: string;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;
  private readonly userAgent: string;
  private readonly fetchImpl: typeof fetch;
  private readonly maxRetryAfterMs: number;
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly random: () => number;

  constructor(opts: DirectTransportOptions = {}) {
    this.endpoint = opts.endpoint ?? GRAPHQL_ENDPOINT;
    this.timeoutMs = opts.timeoutMs ?? 20_000;
    this.maxRetries = opts.maxRetries ?? 2;
    this.userAgent = `hemnet-mcp/${opts.version ?? '0.0.0'} (+https://github.com/chrischall/hemnet-mcp)`;
    this.fetchImpl = opts.fetchImpl ?? fetch;
    this.maxRetryAfterMs = opts.maxRetryAfterMs ?? 10_000;
    this.sleep = opts.sleep ?? delay;
    this.random = opts.random ?? Math.random;
  }

  /**
   * Wait before retry number `retry` (1-based): an exponential window
   * (1s, 2s, …) spread over [window, 1.5 × window) by jitter so concurrent
   * callers (hemnet_compare_listings fans out) don't retry in lockstep, and
   * never shorter than the server's `Retry-After` (capped at
   * `maxRetryAfterMs`) — fleet-audit#495.
   */
  private backoffMs(retry: number, retryAfterMs: number): number {
    const window = BASE_BACKOFF_MS * 2 ** (retry - 1);
    const jittered = Math.floor(window + this.random() * (window / 2));
    return Math.max(jittered, retryAfterMs);
  }

  status(): TransportStatus {
    return { transport: 'direct', mode: 'direct' };
  }

  async graphql<T>(
    query: string,
    variables: Record<string, unknown>,
  ): Promise<GraphQLResponse<T>> {
    const body = JSON.stringify({ query, variables });
    let lastError: unknown;
    // The previous response's honoured `Retry-After` (0 when absent / not
    // an HTTP response), consumed by the next attempt's backoff.
    let retryAfterMs = 0;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      if (attempt > 0) await this.sleep(this.backoffMs(attempt, retryAfterMs));
      retryAfterMs = 0;

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);
      try {
        const res = await this.fetchImpl(this.endpoint, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            accept: 'application/json',
            'user-agent': this.userAgent,
          },
          body,
          signal: controller.signal,
        });

        if (res.ok) {
          // Read as text and parse here: a 2xx HTML page (a challenge
          // interstitial, an error page) must neither surface as a bare
          // SyntaxError nor be retried as if it were a network blip
          // (fleet-audit#490).
          const text = await res.text();
          try {
            return JSON.parse(text) as GraphQLResponse<T>;
          } catch {
            throw (
              edgeBlockError(res, text) ??
              new HardHttpError(
                `Hemnet GraphQL HTTP ${res.status} returned non-JSON — body starts: ${text.slice(0, 200)}`,
              )
            );
          }
        }
        // Check EVERY non-OK status for a CDN/WAF refusal before deciding to
        // retry: Cloudflare serves rate-limit blocks as 429 and the legacy JS
        // challenge as 503, and retrying those only delays the bridge
        // fallback (fleet-audit#1019). Reading the body also drains it on
        // the retry path.
        const errBody = await readBodySafely(res);
        const blocked = edgeBlockError(res, errBody);
        if (blocked) throw blocked;
        if (!RETRYABLE_STATUS.has(res.status)) {
          throw hardHttpError(res, errBody.slice(0, 200));
        }
        retryAfterMs = parseRetryAfterMs(res.headers.get('retry-after'), {
          defaultMs: 0,
          capMs: this.maxRetryAfterMs,
        });
        lastError = new Error(`Hemnet GraphQL HTTP ${res.status}`);
      } catch (err) {
        // A hard HTTP error is terminal — propagate at once. Network
        // errors and aborts (timeouts) fall through to the next attempt.
        if (err instanceof HardHttpError || err instanceof EdgeBlockedError) throw err;
        lastError = err;
      } finally {
        clearTimeout(timer);
      }
    }
    throw lastError instanceof Error
      ? lastError
      : new Error('Hemnet GraphQL request failed');
  }
}
