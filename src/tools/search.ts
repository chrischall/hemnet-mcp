import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { HemnetClient } from '../client.js';
import { minifiedResult } from '../mcp.js';
import { formatListingCard } from '../format.js';
import { buildSearchInput, searchInputShape, type SearchArgs } from './_shared.js';

/**
 * `hemnet_search_listings` — search active for-sale listings.
 *
 * Composes the caller's location + filters into a `searchForSaleListings`
 * query and returns normalised {@link ListingSummary} rows (price in
 * kronor, area in m², derived price-per-m²). Location is resolved from
 * either explicit `location_ids` or a free-text `location`.
 */
export function registerSearchTools(
  server: McpServer,
  client: HemnetClient,
): void {
  server.registerTool(
    'hemnet_search_listings',
    {
      title: 'Search Hemnet for-sale listings',
      description:
        'Search active for-sale property listings on hemnet.se by location and optional filters (price band in SEK, rooms, living area in m², property-type groups, keywords). Returns listing summaries with price, fee, m², rooms, price-per-m², and coordinates. Provide `location_ids` (from hemnet_autocomplete_location) or a free-text `location`. Read-only.',
      annotations: {
        title: 'Search Hemnet for-sale listings',
        readOnlyHint: true,
        idempotentHint: true,
        openWorldHint: true,
      },
      inputSchema: searchInputShape,
    },
    async (args: SearchArgs) => {
      const search = await buildSearchInput(client, args);
      const { total, listings } = await client.searchForSale(search, {
        limit: args.limit ?? 25,
        offset: args.offset ?? 0,
        sort: args.sort ?? 'NEWEST',
      });
      return minifiedResult({
        total,
        count: listings.length,
        location_ids: search.locationIds,
        listings: listings.map(formatListingCard),
      });
    },
  );
}
