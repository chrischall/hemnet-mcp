import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { addressMatch } from '@chrischall/realty-core';
import { messageOf } from '@chrischall/mcp-utils';
import type { HemnetClient } from '../client.js';
import { textResult } from '../mcp.js';
import { formatListingCard, type ListingSummary } from '../format.js';
import type { HemnetSearchInput } from '../graphql.js';

/**
 * `hemnet_get_by_address` — resolve a free-text Swedish street address to
 * a live Hemnet for-sale listing.
 *
 * Hemnet addresses listings by an opaque numeric id, so an address can't
 * be turned into a listing URL directly — it needs a server-side
 * resolution step (the same role homes-mcp's `homes_get_by_address`
 * plays in the realty cohort's cross-portal canonical-URL caller). The
 * rungs:
 *
 *   1. Resolve the `location` (city/area/municipality) to a Hemnet
 *      location id via `autocompleteLocations`.
 *   2. Search that location's for-sale listings (optionally price-banded).
 *   3. Verify each candidate's `streetAddress` against the input with
 *      realty-core's portal-agnostic `addressMatch` (whole-token street +
 *      exact numeric anchor). Return the best match.
 *
 * **Graceful degradation.** A no-match, an unresolvable location, or a
 * transport error returns `{ resolved: false, error }` rather than
 * throwing — so a cross-portal fan-out gets a partial, not a fatal.
 */
export function registerByAddressTools(
  server: McpServer,
  client: HemnetClient,
): void {
  server.registerTool(
    'hemnet_get_by_address',
    {
      title: 'Resolve a street address to a Hemnet listing',
      description:
        'Resolve a free-text Swedish street address to a live Hemnet for-sale listing. Give the `address` (street + number) and a `location` (city/area/municipality). Returns the matched listing with a `matched: true`, the match `score`, and `matched_via`, or `{ resolved: false }` when nothing matches. Read-only.',
      annotations: {
        title: 'Resolve a street address to a Hemnet listing',
        readOnlyHint: true,
        idempotentHint: true,
        openWorldHint: true,
      },
      inputSchema: {
        address: z
          .string()
          .min(1)
          .describe('Street address incl. number, e.g. "Gäddstigen 1".'),
        location: z
          .string()
          .min(1)
          .describe('City / area / municipality, e.g. "Södertälje" or "Vasastan".'),
        price_min: z.number().int().nonnegative().optional().describe('SEK, narrows the search rung.'),
        price_max: z.number().int().nonnegative().optional().describe('SEK, narrows the search rung.'),
      },
    },
    async ({ address, location, price_min, price_max }) => {
      try {
        const hits = await client.autocompleteLocations(location, 1);
        const top = hits[0];
        if (!top) {
          return textResult({
            resolved: false,
            error: `No Hemnet location matched "${location}".`,
          });
        }

        const search: HemnetSearchInput = { locationIds: [top.locationId] };
        if (price_min != null) search.priceMin = price_min;
        if (price_max != null) search.priceMax = price_max;

        const { listings } = await client.searchForSale(search, { limit: 50 });

        let best: { record: ListingSummary; score: number } | null = null;
        for (const raw of listings) {
          const candidate = raw.streetAddress;
          if (!candidate) continue;
          const { matched, score } = addressMatch(address, candidate);
          if (matched && (best === null || score > best.score)) {
            best = { record: formatListingCard(raw), score };
          }
        }

        if (!best) {
          return textResult({
            resolved: false,
            location_id: top.locationId,
            searched: listings.length,
            error: `No for-sale listing in ${top.fullName ?? location} matched "${address}".`,
          });
        }

        return textResult({
          resolved: true,
          matched: true,
          matched_via: 'search',
          score: best.score,
          location_id: top.locationId,
          listing: best.record,
        });
      } catch (err) {
        return textResult({ resolved: false, error: messageOf(err) });
      }
    },
  );
}
