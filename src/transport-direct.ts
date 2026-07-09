/**
 * Default Hemnet transport: a direct Node `fetch` to
 * `https://www.hemnet.se/graphql`.
 *
 * Hemnet serves the read queries anonymously — no bearer, cookie, or
 * CSRF token — so unlike the fetchproxy fleet members this needs no
 * browser session and no optional peer deps. It stays deliberately thin:
 * POST the operation, retry a couple of times on 429 / 5xx / network
 * blips with backoff, parse the JSON envelope. Everything Hemnet-semantic
 * (GraphQL-error classification, empty-node handling) lives on the client.
 *
 * There are no secrets in play here, so — unlike the bearer clients in
 * @chrischall/mcp-utils — nothing needs redaction. A descriptive
 * User-Agent identifies the client honestly rather than impersonating a
 * browser.
 */
import type { GraphQLResponse, HemnetTransport } from './transport.js';

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
}

const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);

/** Sleep helper — extracted so it's obvious in a backoff loop. */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * A non-retryable HTTP failure (a 4xx other than 429). Thrown from inside
 * the retry loop's `try` so the `catch` can tell it apart from a
 * retryable network/abort error and propagate it immediately.
 */
class HardHttpError extends Error {}

export class DirectTransport implements HemnetTransport {
  private readonly endpoint: string;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;
  private readonly userAgent: string;
  private readonly fetchImpl: typeof fetch;

  constructor(opts: DirectTransportOptions = {}) {
    this.endpoint = opts.endpoint ?? GRAPHQL_ENDPOINT;
    this.timeoutMs = opts.timeoutMs ?? 20_000;
    this.maxRetries = opts.maxRetries ?? 2;
    this.userAgent = `hemnet-mcp/${opts.version ?? '0.0.0'} (+https://github.com/chrischall/hemnet-mcp)`;
    this.fetchImpl = opts.fetchImpl ?? fetch;
  }

  async graphql<T>(
    query: string,
    variables: Record<string, unknown>,
  ): Promise<GraphQLResponse<T>> {
    const body = JSON.stringify({ query, variables });
    let lastError: unknown;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      if (attempt > 0) await delay(2 ** attempt * 250);

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
          return (await res.json()) as GraphQLResponse<T>;
        }
        // A retryable status loops with backoff; any other non-2xx is a
        // hard failure we surface immediately (no point retrying a 400).
        if (!RETRYABLE_STATUS.has(res.status)) {
          throw new HardHttpError(`Hemnet GraphQL HTTP ${res.status}`);
        }
        lastError = new Error(`Hemnet GraphQL HTTP ${res.status}`);
      } catch (err) {
        // A hard HTTP error is terminal — propagate at once. Network
        // errors and aborts (timeouts) fall through to the next attempt.
        if (err instanceof HardHttpError) throw err;
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
