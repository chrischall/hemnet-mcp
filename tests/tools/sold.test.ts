import { describe, it, expect } from 'vitest';
import { createTestHarness, parseToolResult, routedClient } from '../helpers.js';
import { registerSoldTools } from '../../src/tools/sold.js';
import { SALE_CARD, SOLD_DETAIL, LOCATION_HIT } from '../fixtures.js';

describe('hemnet_search_sold', () => {
  it('returns normalised sold cards', async () => {
    const client = routedClient({
      AutocompleteLocations: { data: { autocompleteLocations: { hits: [LOCATION_HIT] } } },
      SearchSales: { data: { searchSales: { total: 5, cards: [SALE_CARD] } } },
    });
    const h = await createTestHarness((s) => registerSoldTools(s, client));
    const res = await h.callTool('hemnet_search_sold', { location: 'Vasastan' });
    const body = parseToolResult<{ total: number; sales: { final_price: number }[] }>(res);
    expect(body.total).toBe(5);
    expect(body.sales[0]!.final_price).toBe(5950000);
    await h.close();
  });
});

describe('hemnet_get_sold_listing', () => {
  it('returns a sold detail by id', async () => {
    const client = routedClient({
      GetSoldListing: { data: { soldListing: SOLD_DETAIL } },
    });
    const h = await createTestHarness((s) => registerSoldTools(s, client));
    const res = await h.callTool('hemnet_get_sold_listing', {
      id: 'https://www.hemnet.se/salda/lagenhet-2rum-6254767670540539069',
    });
    const body = parseToolResult<{ id: string; final_price: number }>(res);
    expect(body.id).toBe('6254767670540539069');
    expect(body.final_price).toBe(5950000);
    await h.close();
  });

  it('errors on an unparseable id', async () => {
    const client = routedClient({});
    const h = await createTestHarness((s) => registerSoldTools(s, client));
    const res = await h.callTool('hemnet_get_sold_listing', { id: 'https://www.hemnet.se/salda' });
    expect(res.isError).toBe(true);
    await h.close();
  });

  it('errors when nothing is found', async () => {
    const client = routedClient({ GetSoldListing: { data: { soldListing: null } } });
    const h = await createTestHarness((s) => registerSoldTools(s, client));
    const res = await h.callTool('hemnet_get_sold_listing', { id: '123' });
    expect(res.isError).toBe(true);
    await h.close();
  });
});
