import { describe, it, expect } from 'vitest';
import { createTestHarness, parseToolResult, routedClient } from '../helpers.js';
import { fakeTransport } from '../helpers.js';
import { HemnetClient } from '../../src/client.js';
import { registerSearchTools } from '../../src/tools/search.js';
import { LISTING_CARD, LOCATION_HIT } from '../fixtures.js';

describe('hemnet_search_listings', () => {
  it('searches with explicit location_ids and maps every filter', async () => {
    const transport = fakeTransport((query) =>
      query.includes('SearchForSale')
        ? { data: { searchForSaleListings: { total: 1, listings: [LISTING_CARD] } } }
        : { errors: [{ message: 'unexpected' }] },
    );
    const client = new HemnetClient({ transport });
    const h = await createTestHarness((s) => registerSearchTools(s, client));
    const res = await h.callTool('hemnet_search_listings', {
      location_ids: ['17744'],
      price_min: 1_000_000,
      price_max: 5_000_000,
      rooms_min: 2,
      rooms_max: 4,
      living_area_min: 40,
      living_area_max: 120,
      housing_form_groups: ['APARTMENTS'],
      keywords: 'balkong',
      sort: 'OLDEST',
      limit: 10,
    });
    const body = parseToolResult<{ total: number; listings: unknown[] }>(res);
    expect(body.total).toBe(1);
    // The mapped search input reached the transport.
    const sent = transport.calls[0]!.variables.search as Record<string, unknown>;
    expect(sent).toMatchObject({
      locationIds: ['17744'],
      priceMin: 1_000_000,
      priceMax: 5_000_000,
      roomsMin: 2,
      roomsMax: 4,
      livingAreaMin: 40,
      livingAreaMax: 120,
      housingFormGroups: ['APARTMENTS'],
      keywords: 'balkong',
    });
    await h.close();
  });

  it('resolves a free-text location to its top hit', async () => {
    const client = routedClient({
      AutocompleteLocations: { data: { autocompleteLocations: { hits: [LOCATION_HIT] } } },
      SearchForSale: { data: { searchForSaleListings: { total: 0, listings: [] } } },
    });
    const h = await createTestHarness((s) => registerSearchTools(s, client));
    const res = await h.callTool('hemnet_search_listings', { location: 'Vasastan' });
    const body = parseToolResult<{ location_ids: string[] }>(res);
    expect(body.location_ids).toEqual(['925970']);
    await h.close();
  });

  it('errors when a free-text location resolves to nothing', async () => {
    const client = routedClient({
      AutocompleteLocations: { data: { autocompleteLocations: { hits: [] } } },
    });
    const h = await createTestHarness((s) => registerSearchTools(s, client));
    const res = await h.callTool('hemnet_search_listings', { location: 'Nowhere' });
    expect(res.isError).toBe(true);
    await h.close();
  });

  it('errors when no location is provided', async () => {
    const client = routedClient({});
    const h = await createTestHarness((s) => registerSearchTools(s, client));
    const res = await h.callTool('hemnet_search_listings', {});
    expect(res.isError).toBe(true);
    await h.close();
  });
});
