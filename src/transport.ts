/**
 * Transport-agnostic interface for talking to Hemnet's GraphQL endpoint.
 *
 * The whole client (src/client.ts) is written against this one method so
 * tests can drive every tool through an in-memory fake (see
 * tests/helpers.ts) with zero network, and so an alternative transport
 * (e.g. a fetchproxy bridge for the auth-gated "Mitt Hemnet" surfaces, or
 * a realty-meta-supplied fetcher) can be swapped in without touching a
 * single tool. The default implementation is the zero-dependency direct
 * `fetch` in src/transport-direct.ts.
 *
 * The transport owns ONLY the wire round-trip + JSON parse. It does NOT
 * interpret GraphQL `errors`, map them to typed exceptions, or reach into
 * `data` — those are Hemnet-semantic concerns and live on the client,
 * which runs them over the returned envelope. This mirrors the fleet's
 * transport/client split (see homes-mcp's HomesTransport).
 */

import type { BridgeHealthcheckTransport } from '@chrischall/mcp-utils/fetchproxy';

/** The GraphQL response envelope: exactly one of `data` / `errors` is meaningful. */
export interface GraphQLResponse<T> {
  data?: T | null;
  errors?: { message: string }[];
}

/**
 * Which path a transport is serving on. Surfaced by `hemnet_healthcheck`
 * (as its `transport` field) so a failure isolates to the right leg:
 * `transport` is the path the next request rides, `mode` is the
 * configured `HEMNET_TRANSPORT`. The bridge's own live state (role, port,
 * extension link) is not duplicated here — the healthcheck projects it
 * from {@link HemnetTransport.bridgeTransport} once a bridge exists.
 *
 * A `type` alias (not an interface) so it is assignable to mcp-utils'
 * index-signatured `HealthcheckPath` without a cast.
 */
export type TransportStatus = {
  transport: 'direct' | 'fetchproxy' | 'unknown';
  mode: 'direct' | 'fetchproxy' | 'auto';
};

export interface HemnetTransport {
  /**
   * Execute one GraphQL operation and return the raw `{ data, errors }`
   * envelope. Rejects only on transport-level failure (network error,
   * non-2xx HTTP status after retries, unparseable body) — a GraphQL
   * `errors` array is a successful round-trip and comes back in the
   * envelope for the client to classify.
   */
  graphql<T>(
    query: string,
    variables: Record<string, unknown>,
  ): Promise<GraphQLResponse<T>>;
  /**
   * Optional: report which path this transport serves on (see
   * {@link TransportStatus}). Consumers supplying their own fetcher may
   * omit it; the healthcheck then omits its `transport` field.
   */
  status?(): TransportStatus;
  /**
   * Optional: the live fetchproxy bridge (`runProbe` + `status`), for the
   * shared bridge healthcheck to project role / port / extension-link
   * state from. `undefined` while no bridge exists — on the direct path,
   * or on the default fallback before a Cloudflare challenge builds one.
   */
  bridgeTransport?(): BridgeHealthcheckTransport | undefined;
}
