import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { mapWithConcurrency, messageOf } from '@chrischall/mcp-utils';
import type { HemnetClient } from '../client.js';
import { textResult } from '../mcp.js';
import { formatListingDetail } from '../format.js';
import { extractListingId } from '../url.js';

/**
 * `hemnet_compare_listings` — fetch several for-sale listings at once for
 * side-by-side comparison.
 *
 * Fans `hemnet_get_listing` out over up to 20 ids/URLs with bounded
 * concurrency, preserving input order. Per-row failures (bad id, sold
 * listing, transport error) are captured as `{ error }` entries rather
 * than failing the whole call — the same partial-tolerance the fleet's
 * bulk tools use.
 */
const MAX_TARGETS = 20;
const CONCURRENCY = 5;

export function registerCompareTools(
  server: McpServer,
  client: HemnetClient,
): void {
  server.registerTool(
    'hemnet_compare_listings',
    {
      title: 'Compare several Hemnet listings',
      description:
        'Fetch and normalise multiple active for-sale Hemnet listings at once (by id or /bostad/ URL) for side-by-side comparison. Up to 20 targets; input order preserved; per-row errors captured. Read-only.',
      annotations: {
        title: 'Compare several Hemnet listings',
        readOnlyHint: true,
        idempotentHint: true,
        openWorldHint: true,
      },
      inputSchema: {
        ids: z
          .array(z.string().min(1))
          .min(1)
          .max(MAX_TARGETS)
          .describe('Hemnet listing ids or /bostad/ URLs (max 20).'),
      },
    },
    async ({ ids }) => {
      const results = await mapWithConcurrency(ids, CONCURRENCY, async (raw) => {
        const listingId = extractListingId(raw);
        if (!listingId) {
          return { input: raw, error: 'could not parse a Hemnet listing id' };
        }
        try {
          const node = await client.getListing(listingId);
          if (!node) {
            return {
              input: raw,
              error: 'no active for-sale listing (may have sold)',
            };
          }
          return { input: raw, listing: formatListingDetail(node) };
        } catch (err) {
          return { input: raw, error: messageOf(err) };
        }
      });
      return textResult({ count: results.length, results });
    },
  );
}
