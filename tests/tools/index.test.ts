import { describe, it, expect } from 'vitest';
import { createTestHarness, routedClient } from '../helpers.js';
import { registerHemnetTools } from '../../src/tools/index.js';

describe('registerHemnetTools', () => {
  it('registers all 11 hemnet_* tools', async () => {
    const h = await createTestHarness((s) => registerHemnetTools(s, routedClient({})));
    const names = (await h.listTools()).map((t) => t.name).sort();
    expect(names).toEqual(
      [
        'hemnet_autocomplete_location',
        'hemnet_calculate_mortgage',
        'hemnet_compare_listings',
        'hemnet_get_by_address',
        'hemnet_get_listing',
        'hemnet_get_listing_photos',
        'hemnet_get_market_stats',
        'hemnet_get_sold_listing',
        'hemnet_healthcheck',
        'hemnet_search_listings',
        'hemnet_search_sold',
      ].sort(),
    );
    await h.close();
  });
});
