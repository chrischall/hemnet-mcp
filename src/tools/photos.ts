import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { McpToolError } from '@chrischall/mcp-utils';
import type { HemnetClient } from '../client.js';
import { minifiedResult } from '../mcp.js';
import { extractListingId } from '../url.js';

/**
 * `hemnet_get_listing_photos` — just the gallery image URLs for a listing.
 *
 * A thin projection over `hemnet_get_listing`: same detail query, but
 * returns only the CDN image URLs (and total count) so a caller after
 * photos doesn't pay for the whole detail payload in its context. Images
 * come from Hemnet's `bilder.hemnet.se` CDN at `ITEMGALLERY_L` size.
 */
export function registerPhotosTools(
  server: McpServer,
  client: HemnetClient,
): void {
  server.registerTool(
    'hemnet_get_listing_photos',
    {
      title: 'Get photo URLs for a Hemnet listing',
      description:
        'Return the gallery photo URLs for an active for-sale Hemnet listing by id or /bostad/ URL. Read-only.',
      annotations: {
        title: 'Get photo URLs for a Hemnet listing',
        readOnlyHint: true,
        idempotentHint: true,
        openWorldHint: true,
      },
      inputSchema: {
        id: z
          .string()
          .min(1)
          .describe('Hemnet listing id, or a full hemnet.se /bostad/ URL.'),
        limit: z
          .number()
          .int()
          .min(1)
          .max(300)
          .optional()
          .describe('Max photos to return. Default 50.'),
      },
    },
    async ({ id, limit }) => {
      const listingId = extractListingId(id);
      if (!listingId) {
        throw new McpToolError(`Could not parse a Hemnet listing id from "${id}".`);
      }
      const node = await client.getListing(listingId, limit ?? 50);
      if (!node) {
        throw new McpToolError(
          `No active for-sale Hemnet listing found for id ${listingId}.`,
        );
      }
      const photos = (node.images?.images ?? [])
        .map((i) => i.url)
        .filter((u): u is string => typeof u === 'string');
      return minifiedResult({
        id: node.id,
        photo_count: node.images?.total ?? photos.length,
        photos,
      });
    },
  );
}
