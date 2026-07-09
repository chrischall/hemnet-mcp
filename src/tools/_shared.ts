/**
 * Shared tool plumbing: the search-filter zod shape + input builder used
 * by `hemnet_search_listings`, `hemnet_search_sold`, and the
 * search-fallback rung of `hemnet_get_by_address`.
 *
 * Hemnet's search takes numeric `locationIds` (never a place name), so
 * every search tool accepts EITHER an explicit `location_ids` array OR a
 * free-text `location` that we resolve to its top autocomplete hit. The
 * builder centralises that resolution + the filter mapping so the three
 * call sites stay consistent.
 */
import { z } from 'zod';
import { McpToolError } from '@chrischall/mcp-utils';
import type { HemnetClient } from '../client.js';
import {
  HOUSING_FORM_GROUPS,
  SORT_OPTIONS,
  type HemnetSearchInput,
} from '../graphql.js';

/** The reusable zod raw-shape for search filters. */
export const searchInputShape = {
  location_ids: z
    .array(z.string())
    .optional()
    .describe(
      'Numeric Hemnet location ids (from hemnet_autocomplete_location). Provide this OR `location`.',
    ),
  location: z
    .string()
    .optional()
    .describe(
      'Free-text place name (e.g. "Vasastan", "Göteborg") resolved to its top Hemnet location. Ignored when `location_ids` is set.',
    ),
  price_min: z.number().int().nonnegative().optional().describe('SEK'),
  price_max: z.number().int().nonnegative().optional().describe('SEK'),
  rooms_min: z.number().positive().optional(),
  rooms_max: z.number().positive().optional(),
  living_area_min: z.number().positive().optional().describe('m²'),
  living_area_max: z.number().positive().optional().describe('m²'),
  housing_form_groups: z
    .array(z.enum(HOUSING_FORM_GROUPS))
    .optional()
    .describe(
      'Property-type groups: HOUSES (villa), APARTMENTS (lägenhet/bostadsrätt), ROW_HOUSES (radhus/parhus), VACATION_HOMES (fritidshus), PLOTS (tomt), OTHERS.',
    ),
  keywords: z
    .string()
    .optional()
    .describe('Free-text keyword filter (e.g. "sjönära", "balkong").'),
  sort: z.enum(SORT_OPTIONS).optional().describe('NEWEST (default) or OLDEST.'),
  limit: z.number().int().min(1).max(50).optional().describe('Default 25, max 50.'),
  offset: z.number().int().nonnegative().optional().describe('Pagination offset.'),
};

/** Parsed args from {@link searchInputShape}. */
export interface SearchArgs {
  location_ids?: string[];
  location?: string;
  price_min?: number;
  price_max?: number;
  rooms_min?: number;
  rooms_max?: number;
  living_area_min?: number;
  living_area_max?: number;
  housing_form_groups?: HemnetSearchInput['housingFormGroups'];
  keywords?: string;
  sort?: 'NEWEST' | 'OLDEST';
  limit?: number;
  offset?: number;
}

/**
 * Resolve the caller's location into `locationIds` and map the filter
 * args onto the GraphQL search input. Throws a clean argument error when
 * no location was given or a free-text name resolves to nothing.
 */
export async function buildSearchInput(
  client: HemnetClient,
  args: SearchArgs,
): Promise<HemnetSearchInput> {
  let locationIds = args.location_ids;
  if ((!locationIds || locationIds.length === 0) && args.location) {
    const hits = await client.autocompleteLocations(args.location, 1);
    const top = hits[0];
    if (!top) {
      throw new McpToolError(
        `No Hemnet location matched "${args.location}". Try hemnet_autocomplete_location to find a location id.`,
      );
    }
    locationIds = [top.locationId];
  }
  if (!locationIds || locationIds.length === 0) {
    throw new McpToolError(
      'Provide a location: either `location_ids` (from hemnet_autocomplete_location) or a free-text `location`.',
    );
  }

  const input: HemnetSearchInput = { locationIds };
  if (args.price_min != null) input.priceMin = args.price_min;
  if (args.price_max != null) input.priceMax = args.price_max;
  if (args.rooms_min != null) input.roomsMin = args.rooms_min;
  if (args.rooms_max != null) input.roomsMax = args.rooms_max;
  if (args.living_area_min != null) input.livingAreaMin = args.living_area_min;
  if (args.living_area_max != null) input.livingAreaMax = args.living_area_max;
  if (args.housing_form_groups != null)
    input.housingFormGroups = args.housing_form_groups;
  if (args.keywords != null) input.keywords = args.keywords;
  return input;
}
