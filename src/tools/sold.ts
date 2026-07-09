import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { McpToolError } from '@chrischall/mcp-utils';
import type { HemnetClient } from '../client.js';
import { textResult } from '../mcp.js';
import { formatSaleCard, formatSoldDetail } from '../format.js';
import { extractListingId } from '../url.js';
import { buildSearchInput, searchInputShape, type SearchArgs } from './_shared.js';

/**
 * `hemnet_search_sold` + `hemnet_get_sold_listing` — Hemnet's sold-price
 * ("slutpriser") dataset, its most distinctive signal.
 *
 * `searchSales` mirrors the for-sale search shape but each `SaleCard`
 * carries the achieved `final_price`, the `asking_price`, and the
 * over-/under-asking `price_change_percent` — the comps data an agent or
 * realty-meta needs to value a property. `soldListing(id)` returns the
 * full detail node for a single sale.
 */
export function registerSoldTools(
  server: McpServer,
  client: HemnetClient,
): void {
  server.registerTool(
    'hemnet_search_sold',
    {
      title: 'Search Hemnet sold listings (slutpriser)',
      description:
        'Search SOLD property listings ("slutpriser") on hemnet.se by location and optional filters. Each result carries the achieved final price, the asking price, and the over/under-asking percentage — the core comps signal for valuation. Provide `location_ids` (from hemnet_autocomplete_location) or a free-text `location`. Read-only.',
      annotations: {
        title: 'Search Hemnet sold listings (slutpriser)',
        readOnlyHint: true,
        idempotentHint: true,
        openWorldHint: true,
      },
      inputSchema: searchInputShape,
    },
    async (args: SearchArgs) => {
      const search = await buildSearchInput(client, args);
      const { total, cards } = await client.searchSales(search, {
        limit: args.limit ?? 25,
        offset: args.offset ?? 0,
        sort: args.sort ?? 'NEWEST',
      });
      return textResult({
        total,
        count: cards.length,
        location_ids: search.locationIds,
        sales: cards.map(formatSaleCard),
      });
    },
  );

  server.registerTool(
    'hemnet_get_sold_listing',
    {
      title: 'Get a Hemnet sold listing by id or URL',
      description:
        'Fetch the full detail of a single SOLD listing by its Hemnet id or a /salda/ URL. Returns final price, asking price, price change, m², rooms, tenure, broker, and coordinates. Read-only.',
      annotations: {
        title: 'Get a Hemnet sold listing by id or URL',
        readOnlyHint: true,
        idempotentHint: true,
        openWorldHint: true,
      },
      inputSchema: {
        id: z
          .string()
          .min(1)
          .describe('Hemnet sold-listing id, or a full hemnet.se /salda/ URL.'),
      },
    },
    async ({ id }) => {
      const listingId = extractListingId(id);
      if (!listingId) {
        throw new McpToolError(`Could not parse a Hemnet listing id from "${id}".`);
      }
      const node = await client.getSoldListing(listingId);
      if (!node) {
        throw new McpToolError(
          `No sold Hemnet listing found for id ${listingId}.`,
        );
      }
      return textResult(formatSoldDetail(node));
    },
  );
}
