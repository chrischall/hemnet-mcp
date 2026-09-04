import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { HemnetClient } from '../client.js';
import { minifiedResult } from '@chrischall/mcp-utils';
import { formatLocationHit } from '../format.js';

/**
 * `hemnet_autocomplete_location` — resolve a free-text place name into
 * Hemnet's numeric location ids.
 *
 * Every Hemnet search keys off numeric `locationIds`, not place names, so
 * this is the entry point: turn "Vasastan" / "Göteborg" / a street area
 * into `{ location_id, full_name, parent_full_name }` hits the search
 * tools accept. `hemnet_search_listings` / `hemnet_search_sold` also take
 * a `location` string and resolve the top hit themselves, but this tool
 * lets a caller disambiguate first (many places share a name across
 * municipalities).
 */
export function registerAutocompleteTools(
  server: McpServer,
  client: HemnetClient,
): void {
  server.registerTool(
    'hemnet_autocomplete_location',
    {
      title: 'Resolve a place name to Hemnet location ids',
      description:
        'Look up Hemnet location ids for a free-text place name (municipality, district, or area). Returns ranked hits with `location_id`, `full_name`, and `parent_full_name`. Feed a `location_id` into hemnet_search_listings / hemnet_search_sold. Read-only.',
      annotations: {
        title: 'Resolve a place name to Hemnet location ids',
        readOnlyHint: true,
        idempotentHint: true,
        openWorldHint: true,
      },
      inputSchema: {
        query: z.string().min(1).describe('Place name, e.g. "Vasastan" or "Malmö".'),
        limit: z.number().int().min(1).max(20).optional().describe('Default 10.'),
      },
    },
    async ({ query, limit }) => {
      const hits = await client.autocompleteLocations(query, limit ?? 10);
      return minifiedResult({
        query,
        count: hits.length,
        locations: hits.map(formatLocationHit),
      });
    },
  );
}
