/**
 * Tool-registrar barrel + the `registerHemnetTools` convenience.
 *
 * `index.ts` (standalone server) and realty-meta (embedding hemnet-mcp's
 * tools into a larger server) both want "wire up every hemnet_* tool
 * against this client" in one call — so it lives here next to the
 * individual registrars, not duplicated at each call site.
 */
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { HemnetClient } from '../client.js';
import { registerAutocompleteTools } from './autocomplete.js';
import { registerSearchTools } from './search.js';
import { registerListingTools } from './listings.js';
import { registerPhotosTools } from './photos.js';
import { registerSoldTools } from './sold.js';
import { registerCompareTools } from './compare.js';
import { registerByAddressTools } from './by-address.js';
import { registerMarketTools } from './market.js';
import { registerMortgageTools } from './mortgage.js';
import { registerHealthcheckTools } from './healthcheck.js';

export {
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
};

/** Register every hemnet_* tool on `server`, backed by `client`. */
export function registerHemnetTools(
  server: McpServer,
  client: HemnetClient,
): void {
  registerAutocompleteTools(server, client);
  registerSearchTools(server, client);
  registerListingTools(server, client);
  registerPhotosTools(server, client);
  registerSoldTools(server, client);
  registerCompareTools(server, client);
  registerByAddressTools(server, client);
  registerMarketTools(server, client);
  registerMortgageTools(server);
  registerHealthcheckTools(server, client);
}
