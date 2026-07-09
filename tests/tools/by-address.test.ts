import { describe, it, expect } from 'vitest';
import { createTestHarness, parseToolResult, routedClient, fakeTransport } from '../helpers.js';
import { HemnetClient } from '../../src/client.js';
import { registerByAddressTools } from '../../src/tools/by-address.js';
import { LISTING_CARD, HOUSE_CARD, LOCATION_HIT } from '../fixtures.js';

describe('hemnet_get_by_address', () => {
  it('matches a listing by street address', async () => {
    const client = routedClient({
      AutocompleteLocations: { data: { autocompleteLocations: { hits: [LOCATION_HIT] } } },
      SearchForSale: {
        data: { searchForSaleListings: { total: 2, listings: [LISTING_CARD, HOUSE_CARD] } },
      },
    });
    const h = await createTestHarness((s) => registerByAddressTools(s, client));
    const res = await h.callTool('hemnet_get_by_address', {
      address: 'Gäddstigen 1',
      location: 'Södertälje',
      price_min: 1000000,
      price_max: 9000000,
    });
    const body = parseToolResult<{ resolved: boolean; matched?: boolean; listing?: { id: string } }>(res);
    expect(body.resolved).toBe(true);
    expect(body.matched).toBe(true);
    expect(body.listing!.id).toBe('21710712');
    await h.close();
  });

  it('keeps the highest-scoring candidate when several match', async () => {
    // Multi-word street (no numeric token, which the matcher drops when not
    // leading) so a partial match (2/3) and an exact match (3/3) both clear
    // the >0.5 threshold — exercising the score comparison in both
    // directions: upgrade to a higher score, then reject a lower later one.
    const partial = { ...HOUSE_CARD, id: 'partial', streetAddress: 'Storgatan Alfa' };
    const exact = { ...HOUSE_CARD, id: 'exact', streetAddress: 'Storgatan Alfa Beta' };
    const partial2 = { ...HOUSE_CARD, id: 'partial2', streetAddress: 'Storgatan Alfa' };
    const client = routedClient({
      AutocompleteLocations: { data: { autocompleteLocations: { hits: [LOCATION_HIT] } } },
      SearchForSale: {
        data: {
          searchForSaleListings: { total: 3, listings: [partial, exact, partial2] },
        },
      },
    });
    const h = await createTestHarness((s) => registerByAddressTools(s, client));
    const res = await h.callTool('hemnet_get_by_address', {
      address: 'Storgatan Alfa Beta',
      location: 'Södertälje',
    });
    const body = parseToolResult<{ listing: { id: string }; score: number }>(res);
    expect(body.listing.id).toBe('exact');
    expect(body.score).toBe(1);
    await h.close();
  });

  it('returns resolved:false when the location does not resolve', async () => {
    const client = routedClient({
      AutocompleteLocations: { data: { autocompleteLocations: { hits: [] } } },
    });
    const h = await createTestHarness((s) => registerByAddressTools(s, client));
    const res = await h.callTool('hemnet_get_by_address', { address: 'X 1', location: 'Nowhere' });
    const body = parseToolResult<{ resolved: boolean }>(res);
    expect(body.resolved).toBe(false);
    expect(res.isError).toBeFalsy();
    await h.close();
  });

  it('returns resolved:false when no candidate matches (and skips address-less rows)', async () => {
    const client = routedClient({
      // fullName null → exercises the `?? location` fallback in the miss message.
      AutocompleteLocations: {
        data: { autocompleteLocations: { hits: [{ locationId: '925970', fullName: null }] } },
      },
      SearchForSale: {
        data: {
          searchForSaleListings: {
            total: 2,
            listings: [{ id: 'nolabel' }, LISTING_CARD],
          },
        },
      },
    });
    const h = await createTestHarness((s) => registerByAddressTools(s, client));
    const res = await h.callTool('hemnet_get_by_address', {
      address: 'Nonexistent Street 999',
      location: 'Vasastan',
    });
    const body = parseToolResult<{ resolved: boolean; searched: number; error: string }>(res);
    expect(body.resolved).toBe(false);
    expect(body.searched).toBe(2);
    expect(body.error).toContain('Vasastan');
    await h.close();
  });

  it('returns resolved:false with the error on a transport failure', async () => {
    const transport = fakeTransport(() => ({ errors: [{ message: 'network down' }] }));
    const client = new HemnetClient({ transport });
    const h = await createTestHarness((s) => registerByAddressTools(s, client));
    const res = await h.callTool('hemnet_get_by_address', { address: 'A 1', location: 'B' });
    const body = parseToolResult<{ resolved: boolean; error: string }>(res);
    expect(body.resolved).toBe(false);
    expect(body.error).toMatch(/network down/);
    await h.close();
  });
});
