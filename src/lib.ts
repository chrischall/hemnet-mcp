/**
 * Library entry point (`import ... from 'hemnet-mcp'`).
 *
 * hemnet-mcp is designed to work two ways:
 *
 *   1. **Standalone MCP server** — `src/index.ts` boots a stdio server
 *      exposing the `hemnet_*` tools (the `bin`). Nothing here is needed
 *      for that path.
 *   2. **A portal source inside realty-mcp** — the planned
 *      `@chrischall/realty-meta` orchestrator consumes Hemnet as one of
 *      several portals. For that it needs the *pieces*, not a running
 *      server: the client, the normalised record types, the pure
 *      derivations, and the tool registrars (to graft `hemnet_*` onto a
 *      combined server). This module re-exports exactly that surface.
 *
 * Because everything reads through a direct GraphQL fetch with no auth,
 * a consumer can construct a client in one line:
 *
 *   import { createHemnetClient } from 'hemnet-mcp';
 *   const client = createHemnetClient();
 *   const { listings } = await client.searchForSale({ locationIds: ['17744'] });
 */

// --- client + transport ------------------------------------------------
export { HemnetClient, DEFAULT_PHOTO_LIMIT } from './client.js';
export type { HemnetClientOptions, SearchOptions } from './client.js';
export { DirectTransport } from './transport-direct.js';
export type { DirectTransportOptions } from './transport-direct.js';
export type { HemnetTransport, GraphQLResponse } from './transport.js';

// --- normalised records + formatters -----------------------------------
export {
  formatLocationHit,
  formatListingCard,
  formatListingDetail,
  formatSaleCard,
  formatSoldDetail,
} from './format.js';
export type {
  Coordinates,
  HousingForm,
  LocationHit,
  ListingSummary,
  ListingDetail,
  SoldSummary,
} from './format.js';

// --- pure derivations --------------------------------------------------
export {
  parseSekAmount,
  parseMeasurement,
  parsePercent,
  formatSek,
} from './money.js';
export { extractListingId, buildListingUrl, buildSoldUrl, HEMNET_ORIGIN } from './url.js';
export { computeMarketStats } from './stats.js';
export type { MarketStats } from './stats.js';
export {
  calculateSwedishMortgage,
  amortizationRate,
  MIN_DOWN_PAYMENT_FRACTION,
} from './mortgage.js';
export type {
  SwedishMortgageInput,
  SwedishMortgageBreakdown,
} from './mortgage.js';

// --- GraphQL search input types ----------------------------------------
export {
  HOUSING_FORM_GROUPS,
  SORT_OPTIONS,
} from './graphql.js';
export type {
  HemnetSearchInput,
  HousingFormGroup,
  SortOption,
} from './graphql.js';

// --- tool registrars ---------------------------------------------------
export {
  registerHemnetTools,
  registerAutocompleteTools,
  registerSearchTools,
  registerListingTools,
  registerPhotosTools,
  registerSoldTools,
  registerCompareTools,
  registerByAddressTools,
  registerMarketTools,
  registerMortgageTools,
  registerHealthcheckTools,
} from './tools/index.js';

import { HemnetClient } from './client.js';
import { DirectTransport } from './transport-direct.js';
import type { DirectTransportOptions } from './transport-direct.js';

/**
 * One-line construction of a ready {@link HemnetClient} over the default
 * direct-`fetch` transport. Pass transport options (endpoint override,
 * timeout, injected fetch) through for tests or a self-hosted proxy.
 */
export function createHemnetClient(
  opts: DirectTransportOptions = {},
): HemnetClient {
  return new HemnetClient({ transport: new DirectTransport(opts) });
}
