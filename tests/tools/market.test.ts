import { describe, it, expect } from 'vitest';
import { createTestHarness, parseToolResult, routedClient } from '../helpers.js';
import { registerMarketTools } from '../../src/tools/market.js';
import { SALE_CARD, LOCATION_HIT } from '../fixtures.js';

describe('hemnet_get_market_stats', () => {
  it('aggregates sold statistics for a location', async () => {
    const client = routedClient({
      AutocompleteLocations: { data: { autocompleteLocations: { hits: [LOCATION_HIT] } } },
      SearchSales: {
        data: { searchSales: { total: 2, cards: [SALE_CARD, SALE_CARD] } },
      },
    });
    const h = await createTestHarness((s) => registerMarketTools(s, client));
    const res = await h.callTool('hemnet_get_market_stats', { location: 'Vasastan' });
    const body = parseToolResult<{
      total_matching_sales: number;
      stats: { sample_size: number; median_final_price: number };
    }>(res);
    expect(body.total_matching_sales).toBe(2);
    expect(body.stats.sample_size).toBe(2);
    expect(body.stats.median_final_price).toBe(5950000);
    await h.close();
  });
});
