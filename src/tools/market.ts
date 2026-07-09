import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { HemnetClient } from '../client.js';
import { textResult } from '../mcp.js';
import { formatSaleCard } from '../format.js';
import { computeMarketStats } from '../stats.js';
import { buildSearchInput, searchInputShape, type SearchArgs } from './_shared.js';

/**
 * `hemnet_get_market_stats` — median/average sold-price statistics for a
 * location, derived from the `searchSales` dataset.
 *
 * Runs the same sold search as `hemnet_search_sold` (so it accepts every
 * filter — narrow by property type, rooms, area, etc.) and aggregates the
 * results into medians/averages (final price, price-per-m², over/under
 * asking). The `sample_size` is surfaced so a caller can see how thin the
 * dataset is before trusting the medians.
 */
export function registerMarketTools(
  server: McpServer,
  client: HemnetClient,
): void {
  server.registerTool(
    'hemnet_get_market_stats',
    {
      title: 'Hemnet sold-price market statistics',
      description:
        'Aggregate median/average statistics from recent SOLD listings for a location (and optional property-type/size filters): median & average final price, median & average price-per-m², and average over/under-asking percentage. Provide `location_ids` or a free-text `location`. Read-only.',
      annotations: {
        title: 'Hemnet sold-price market statistics',
        readOnlyHint: true,
        idempotentHint: true,
        openWorldHint: true,
      },
      inputSchema: searchInputShape,
    },
    async (args: SearchArgs) => {
      const search = await buildSearchInput(client, args);
      const { total, cards } = await client.searchSales(search, {
        limit: args.limit ?? 50,
        offset: args.offset ?? 0,
        sort: args.sort ?? 'NEWEST',
      });
      const sales = cards.map(formatSaleCard);
      return textResult({
        location_ids: search.locationIds,
        total_matching_sales: total,
        stats: computeMarketStats(sales),
      });
    },
  );
}
