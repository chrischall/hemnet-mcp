import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { McpToolError, minifiedResult } from '@chrischall/mcp-utils';
import type { HemnetClient } from '../client.js';
import { formatListingDetail } from '../format.js';
import { extractListingId } from '../url.js';

/**
 * `hemnet_get_listing` — full detail for one active for-sale listing.
 *
 * Accepts a bare Hemnet id or a `/bostad/` URL, reduces it to the id, and
 * returns the normalised {@link ListingDetail}: price/fee/running-costs in
 * kronor, areas in m², rooms, tenure, energy class, broker, description,
 * status labels, and the photo gallery URLs. When the id turns out to be
 * a SOLD listing, the error nudges the caller to `hemnet_get_sold_listing`.
 */
export function registerListingTools(
  server: McpServer,
  client: HemnetClient,
): void {
  server.registerTool(
    'hemnet_get_listing',
    {
      title: 'Get a Hemnet for-sale listing by id or URL',
      description:
        'Fetch the full detail of a single active for-sale listing by its Hemnet id or a /bostad/ URL. Returns price, monthly fee, yearly running costs, living/land area in m², rooms, tenure, construction year, energy class, broker, description, status labels, coordinates, and gallery photo URLs. For a SOLD listing use hemnet_get_sold_listing instead. Read-only.',
      annotations: {
        title: 'Get a Hemnet for-sale listing by id or URL',
        readOnlyHint: true,
        idempotentHint: true,
        openWorldHint: true,
      },
      inputSchema: {
        id: z
          .string()
          .min(1)
          .describe('Hemnet listing id, or a full hemnet.se /bostad/ URL.'),
        photo_limit: z
          .number()
          .int()
          .min(0)
          .max(300)
          .optional()
          .describe('Max gallery photos to include. Default 50.'),
      },
    },
    async ({ id, photo_limit }) => {
      const listingId = extractListingId(id);
      if (!listingId) {
        throw new McpToolError(`Could not parse a Hemnet listing id from "${id}".`);
      }
      const node = await client.getListing(listingId, photo_limit ?? 50);
      if (!node) {
        throw new McpToolError(
          `No active for-sale Hemnet listing found for id ${listingId}. If it has sold, try hemnet_get_sold_listing.`,
        );
      }
      return minifiedResult(formatListingDetail(node));
    },
  );
}
