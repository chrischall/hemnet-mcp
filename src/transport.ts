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

/** The GraphQL response envelope: exactly one of `data` / `errors` is meaningful. */
export interface GraphQLResponse<T> {
  data?: T | null;
  errors?: { message: string }[];
}

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
}
