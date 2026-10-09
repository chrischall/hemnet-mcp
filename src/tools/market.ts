import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/server';
import type { HemnetClient } from '../client.js';
import { minifiedResult } from '@chrischall/mcp-utils';
import type { RawSaleCard } from '../graphql.js';
import { formatSaleCard } from '../format.js';
import { computeMarketStats } from '../stats.js';
import { buildSearchInput, searchInputShape, type SearchArgs } from './_shared.js';

/** Hemnet's `searchSales` page cap. */
const PAGE_SIZE = 50;
/** Default number of sales aggregated (4 pages). */
const DEFAULT_MAX_SALES = 200;
/** Upper bound on `max_sales` (10 pages). */
const MAX_MAX_SALES = 500;

/**
 * The market tool takes the sold-search filters but not `limit`/`offset`:
 * it pages internally, and a caller-chosen window made the stats describe
 * an arbitrary slice (fleet-audit#491).
 */
const { limit: _limit, offset: _offset, ...filterShape } = searchInputShape;

const marketInputShape = {
  ...filterShape,
  max_sales: z
    .number()
    .int()
    .min(1)
    .max(MAX_MAX_SALES)
    .optional()
    .describe(
      `How many sold listings to aggregate, newest first by default (paged ${PAGE_SIZE} at a time). Default ${DEFAULT_MAX_SALES}, max ${MAX_MAX_SALES}.`,
    ),
};

type MarketArgs = Omit<SearchArgs, 'limit' | 'offset'> & { max_sales?: number };

/**
 * `hemnet_get_market_stats` — median/average sold-price statistics for a
 * location, derived from the `searchSales` dataset.
 *
 * Runs the same sold search as `hemnet_search_sold` (so it accepts every
 * filter — narrow by property type, rooms, area, etc.), pages through up
 * to `max_sales` results, and aggregates them into medians/averages (final
 * price, price-per-m², over/under asking). The output states how many of
 * the `total_matching_sales` the stats actually cover (`sampled_sales`,
 * `sample_note`), so a sample is never mistaken for the whole market.
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
        `Aggregate median/average statistics from recent SOLD listings for a location (and optional property-type/size filters): median & average final price, median & average price-per-m², and average over/under-asking percentage. The stats cover the most recent \`max_sales\` sales (default ${DEFAULT_MAX_SALES}, max ${MAX_MAX_SALES}), not necessarily every match — compare \`sampled_sales\` with \`total_matching_sales\`. Provide \`location_ids\` or a free-text \`location\`. Read-only.`,
      annotations: {
        title: 'Hemnet sold-price market statistics',
        readOnlyHint: true,
        idempotentHint: true,
        openWorldHint: true,
      },
      inputSchema: z.object(marketInputShape),
    },
    async (args: MarketArgs) => {
      const search = await buildSearchInput(client, args);
      const sort = args.sort ?? 'NEWEST';
      const maxSales = args.max_sales ?? DEFAULT_MAX_SALES;

      const cards: RawSaleCard[] = [];
      let total = 0;
      while (cards.length < maxSales) {
        const limit = Math.min(PAGE_SIZE, maxSales - cards.length);
        const page = await client.searchSales(search, {
          limit,
          offset: cards.length,
          sort,
        });
        total = page.total;
        cards.push(...page.cards);
        // A short page is the end of the result set, whatever `total` says.
        if (page.cards.length < limit || cards.length >= total) break;
      }

      const sales = cards.map(formatSaleCard);
      const sampled = sales.length;
      const sample_note =
        sampled >= total
          ? `Stats cover all ${sampled} matching sales.`
          : `Stats cover the ${sort === 'OLDEST' ? 'oldest' : 'most recent'} ${sampled} of ${total} matching sales, not every sale.`;
      return minifiedResult({
        location_ids: search.locationIds,
        total_matching_sales: total,
        sampled_sales: sampled,
        sample_note,
        stats: computeMarketStats(sales),
      });
    },
  );
}
