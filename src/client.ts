/**
 * HemnetClient — the typed query surface every tool (and realty-meta)
 * talks to.
 *
 * It wraps a {@link HemnetTransport} (direct `fetch` by default) with the
 * Hemnet-semantic layer the transport deliberately omits:
 *
 *   - GraphQL `errors` → a thrown {@link McpToolError} (message run
 *     through `redactSecrets` + truncation for parity with the fleet's
 *     bearer clients, even though Hemnet's anonymous reads carry no
 *     credential to leak).
 *   - one typed method per operation, each returning the raw node(s) for
 *     the formatters in src/format.ts to normalise.
 *
 * Tools depend on this class, never on the transport or the operation
 * strings directly — so a tool test only has to stub `graphql`.
 */
import {
  McpToolError,
  redactSecrets,
  truncateErrorMessage,
} from '@chrischall/mcp-utils';
import type { HemnetTransport } from './transport.js';
import {
  AUTOCOMPLETE_LOCATIONS,
  GET_LISTING,
  GET_SOLD_LISTING,
  SEARCH_FOR_SALE,
  SEARCH_SALES,
  type HemnetSearchInput,
  type RawListingCard,
  type RawListingDetail,
  type RawLocationHit,
  type RawSaleCard,
  type RawSoldDetail,
  type SortOption,
} from './graphql.js';

/** Default number of gallery images requested by `getListing`. */
export const DEFAULT_PHOTO_LIMIT = 50;

export interface SearchOptions {
  limit?: number;
  offset?: number;
  sort?: SortOption;
}

export interface HemnetClientOptions {
  transport: HemnetTransport;
}

export class HemnetClient {
  private readonly transport: HemnetTransport;

  constructor(opts: HemnetClientOptions) {
    this.transport = opts.transport;
  }

  /**
   * Run a GraphQL operation and return `data`, throwing an
   * {@link McpToolError} on a GraphQL-level `errors` array or a null
   * `data` envelope. Error text is redacted + truncated before surfacing.
   */
  private async run<T>(
    query: string,
    variables: Record<string, unknown>,
  ): Promise<T> {
    const envelope = await this.transport.graphql<T>(query, variables);
    if (envelope.errors && envelope.errors.length > 0) {
      const joined = envelope.errors.map((e) => e.message).join('; ');
      throw new McpToolError(
        `Hemnet GraphQL error: ${truncateErrorMessage(redactSecrets(joined))}`,
      );
    }
    if (envelope.data == null) {
      throw new McpToolError('Hemnet GraphQL returned an empty response.');
    }
    return envelope.data;
  }

  /** Free-text place name → ranked location hits (search takes ids). */
  async autocompleteLocations(
    query: string,
    limit: number,
  ): Promise<RawLocationHit[]> {
    const data = await this.run<{
      autocompleteLocations: { hits: RawLocationHit[] | null } | null;
    }>(AUTOCOMPLETE_LOCATIONS, { query, limit });
    return data.autocompleteLocations?.hits ?? [];
  }

  /** Active for-sale listings for the given search input. */
  async searchForSale(
    search: HemnetSearchInput,
    opts: SearchOptions = {},
  ): Promise<{ total: number; listings: RawListingCard[] }> {
    const data = await this.run<{
      searchForSaleListings: {
        total: number;
        listings: RawListingCard[] | null;
      } | null;
    }>(SEARCH_FOR_SALE, {
      search,
      limit: opts.limit ?? 25,
      offset: opts.offset ?? 0,
      sort: opts.sort ?? 'NEWEST',
    });
    const result = data.searchForSaleListings;
    return { total: result?.total ?? 0, listings: result?.listings ?? [] };
  }

  /** Sold listings ("slutpriser") for the given search input. */
  async searchSales(
    search: HemnetSearchInput,
    opts: SearchOptions = {},
  ): Promise<{ total: number; cards: RawSaleCard[] }> {
    const data = await this.run<{
      searchSales: { total: number; cards: RawSaleCard[] | null } | null;
    }>(SEARCH_SALES, {
      search,
      limit: opts.limit ?? 25,
      offset: opts.offset ?? 0,
      sort: opts.sort ?? 'NEWEST',
    });
    const result = data.searchSales;
    return { total: result?.total ?? 0, cards: result?.cards ?? [] };
  }

  /**
   * Full detail for one active for-sale listing. Returns `null` when the
   * id resolves to nothing, or to a node that is not an
   * `ActivePropertyListing` (e.g. a sold id passed here) — the caller can
   * then fall back to {@link getSoldListing}.
   */
  async getListing(
    id: string,
    photoLimit: number = DEFAULT_PHOTO_LIMIT,
  ): Promise<RawListingDetail | null> {
    const data = await this.run<{
      listing: (RawListingDetail & { __typename?: string }) | null;
    }>(GET_LISTING, { id, photoLimit });
    const node = data.listing;
    if (node == null || node.__typename !== 'ActivePropertyListing') return null;
    return node;
  }

  /** Full detail for one sold listing, or `null` if the id isn't a sale. */
  async getSoldListing(id: string): Promise<RawSoldDetail | null> {
    const data = await this.run<{
      soldListing: (RawSoldDetail & { __typename?: string }) | null;
    }>(GET_SOLD_LISTING, { id });
    const node = data.soldListing;
    if (node == null || node.__typename !== 'SoldPropertyListing') return null;
    return node;
  }

  /**
   * Cheap liveness probe: a tiny autocomplete round-trip. Returns the
   * elapsed ms and hit count; throws (via {@link run}) if the endpoint or
   * transport is down. Backs the `hemnet_healthcheck` tool.
   */
  async healthcheck(): Promise<{ ok: true; hits: number }> {
    const hits = await this.autocompleteLocations('Stockholm', 1);
    return { ok: true, hits: hits.length };
  }
}
