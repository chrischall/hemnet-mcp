/**
 * Default Hemnet transport: a direct Node `fetch` to
 * `https://www.hemnet.se/graphql`.
 *
 * Hemnet's read queries need no bearer, cookie, or CSRF token, but since
 * 2026-07-13 Cloudflare challenges non-browser clients; this transport
 * then raises {@link CloudflareChallengeError} and the default
 * FallbackTransport (src/transport-fallback.ts) switches to the browser
 * bridge. It stays deliberately thin:
 * POST the operation, retry a couple of times on 429 / 5xx / network
 * blips with jittered exponential backoff (honouring a capped
 * `Retry-After` as a floor), parse the JSON envelope. Everything
 * Hemnet-semantic (GraphQL-error classification, empty-node handling)
 * lives on the client.
 *
 * The wire loop itself is mcp-utils' `createGraphqlClient` (fleet-audit#1261):
 * this file only supplies the endpoint, the User-Agent, the retry policy and
 * Hemnet's own error shapes (the challenge diagnostics, the "body starts: …"
 * hard-HTTP message, and the raw network error rather than a wrapped one).
 *
 * There are no secrets in play here, so — unlike the bearer clients in
 * @chrischall/mcp-utils — nothing needs redaction. A descriptive
 * User-Agent identifies the client honestly rather than impersonating a
 * browser.
 */
import { EdgeBlockedError } from '@chrischall/mcp-utils';
import {
  GraphqlTransportError,
  createGraphqlClient,
  responseDiagnostics,
  type GraphqlClient,
} from '@chrischall/mcp-utils/graphql';
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

const RETRYABLE_STATUS = [429, 500, 502, 503, 504];

/** Backoff window before the first retry; doubles per retry (1s, 2s, …). */
const BASE_BACKOFF_MS = 1000;

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

/** ` (server: …; cf-ray: …)`, or `''` when none of those headers is present. */
function diagnosticsSuffix(headers: Headers): string {
  const diag = responseDiagnostics(headers);
  return diag ? ` (${diag})` : '';
}

export class DirectTransport implements HemnetTransport {
  private readonly client: GraphqlClient;
  private readonly timeoutMs: number;

  constructor(opts: DirectTransportOptions = {}) {
    this.timeoutMs = opts.timeoutMs ?? 20_000;
    const userAgent = `hemnet-mcp/${opts.version ?? '0.0.0'} (+https://github.com/chrischall/hemnet-mcp)`;
    this.client = createGraphqlClient({
      endpoint: opts.endpoint ?? GRAPHQL_ENDPOINT,
      serviceName: 'Hemnet',
      headers: { 'user-agent': userAgent },
      timeout: this.timeoutMs,
      // An exponential window (1s, 2s, …) spread over [window, 1.5 × window)
      // by jitter so concurrent callers (hemnet_compare_listings fans out)
      // don't retry in lockstep, and never shorter than the server's
      // `Retry-After` (capped at `maxRetryAfterMs`) — fleet-audit#495.
      retry: {
        count: opts.maxRetries ?? 2,
        delayMs: BASE_BACKOFF_MS,
        statuses: RETRYABLE_STATUS,
        transportErrors: true,
        backoff: 'exponential',
        jitter: 0.5,
        honorRetryAfter: true,
        retryAfterAsFloor: true,
        maxRetryAfterMs: opts.maxRetryAfterMs ?? 10_000,
      },
      ...(opts.random ? { random: opts.random } : {}),
      ...(opts.sleep ? { sleep: opts.sleep } : {}),
      ...(opts.fetchImpl ? { fetchImpl: opts.fetchImpl } : {}),
      // A CDN/WAF refusal at ANY status — Cloudflare serves rate-limit blocks
      // as 429 and the legacy JS challenge as 503, and a challenge page can
      // come back as a 2xx — is thrown at once, never retried (fleet-audit#1019,
      // #490).
      onEdgeBlocked: ({ status, vendor, headers }) =>
        new CloudflareChallengeError(
          `Hemnet GraphQL HTTP ${status} — ${vendor} bot challenge` +
            `${diagnosticsSuffix(headers)}. Hemnet challenges non-browser clients; ` +
            'requests must ride a real browser session (ContextMint Bridge).',
          status,
          vendor,
        ),
      onRateLimited: ({ status }) => new Error(`Hemnet GraphQL HTTP ${status}`),
      // A bare "HTTP 403" hides which failure mode (bot wall vs. moved
      // endpoint vs. bad request) you're in, so a hard failure carries the
      // diagnostic headers and the first ~200 chars of the body.
      onErrorResponse: ({ status, headers, body }) => {
        if (status < 400) {
          return new Error(
            `Hemnet GraphQL HTTP ${status} returned non-JSON — body starts: ${body.slice(0, 200)}`,
          );
        }
        if (RETRYABLE_STATUS.includes(status)) return new Error(`Hemnet GraphQL HTTP ${status}`);
        const head = body.slice(0, 200);
        return new Error(
          `Hemnet GraphQL HTTP ${status}${diagnosticsSuffix(headers)}` +
            `${head ? ` — body starts: ${head}` : ''}`,
        );
      },
    });
  }

  status(): TransportStatus {
    return { transport: 'direct', mode: 'direct' };
  }

  async graphql<T>(
    query: string,
    variables: Record<string, unknown>,
  ): Promise<GraphQLResponse<T>> {
    try {
      // Every Hemnet operation is a read, so every one may be retried.
      const { status: _status, headers: _headers, ...envelope } = await this.client.execute<T>({
        query,
        variables,
        idempotent: true,
      });
      return envelope as GraphQLResponse<T>;
    } catch (err) {
      throw this.unwrap(err);
    }
  }

  /**
   * The last network error as-is (as before the migration), and a timeout as
   * an "aborted" error, rather than the shared client's wrapper.
   */
  private unwrap(err: unknown): unknown {
    if (!(err instanceof GraphqlTransportError)) return err;
    if (err.timedOut) {
      return new Error(`Hemnet GraphQL request aborted: no response within ${this.timeoutMs}ms`, { cause: err });
    }
    return err.cause instanceof Error ? err.cause : new Error('Hemnet GraphQL request failed');
  }
}
