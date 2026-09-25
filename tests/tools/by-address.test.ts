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
    // Multi-word street with no house number (a number would be a hard
    // anchor) so a partial match (2/3) and an exact match (3/3) both clear
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

  it('anchors on the trailing house number: "Storgatan 12" never resolves to 14, "Kungsgatan 3A" never to 3 (fleet-audit#917)', async () => {
    // Swedish addresses put the number LAST. realty-core <0.4.7 dropped a
    // trailing short number, so every Storgatan listing scored 1.0 and the
    // newest (a different flat) came back as a verified match. <0.4.8 also
    // dropped a letter-suffixed number ("3A") and hard-rejected a floor
    // suffix ("12, 3 tr"). The wrong houses come FIRST so a bad matcher
    // would stop on them.
    const at = (id: string, streetAddress: string) => ({ ...HOUSE_CARD, id, streetAddress });
    const client = routedClient({
      AutocompleteLocations: { data: { autocompleteLocations: { hits: [LOCATION_HIT] } } },
      SearchForSale: {
        data: {
          searchForSaleListings: {
            total: 4,
            listings: [
              at('storgatan-14', 'Storgatan 14'),
              at('storgatan-12', 'Storgatan 12'),
              at('kungsgatan-3', 'Kungsgatan 3'),
              at('kungsgatan-3a', 'Kungsgatan 3A'),
            ],
          },
        },
      },
    });
    const h = await createTestHarness((s) => registerByAddressTools(s, client));
    const resolve = async (address: string) =>
      parseToolResult<{ resolved: boolean; score?: number; listing?: { id: string } }>(
        await h.callTool('hemnet_get_by_address', { address, location: 'Södertälje' }),
      );

    const storgatan = await resolve('Storgatan 12');
    expect(storgatan.listing?.id).toBe('storgatan-12');
    expect(storgatan.score).toBe(1);

    const kungsgatan = await resolve('Kungsgatan 3A');
    expect(kungsgatan.listing?.id).toBe('kungsgatan-3a');

    // A floor suffix on the query ("3 tr") is stripped, not a hard reject.
    const floor = await resolve('Storgatan 12, 3 tr');
    expect(floor.listing?.id).toBe('storgatan-12');

    // No listing at number 16 → a miss, never the neighbour.
    expect((await resolve('Storgatan 16')).resolved).toBe(false);
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
    expect((body as { truncated?: boolean }).truncated).toBe(false);
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

  // Filler rows whose street never matches the query addresses below.
  const filler = (n: number, from = 0) =>
    Array.from({ length: n }, (_, i) => ({
      ...LISTING_CARD,
      id: `filler-${from + i}`,
      streetAddress: `Fyllnadsvägen ${from + i + 100}`,
    }));

  it('pages past the 50 newest listings to find an older match', async () => {
    const offsets: number[] = [];
    const client = routedClient({
      AutocompleteLocations: { data: { autocompleteLocations: { hits: [LOCATION_HIT] } } },
      SearchForSale: (vars) => {
        const offset = vars.offset as number;
        offsets.push(offset);
        const listings = offset === 0 ? filler(50) : [...filler(10, 50), HOUSE_CARD];
        return { data: { searchForSaleListings: { total: 61, listings } } };
      },
    });
    const h = await createTestHarness((s) => registerByAddressTools(s, client));
    const res = await h.callTool('hemnet_get_by_address', {
      address: 'Gäddstigen 1',
      location: 'Södertälje',
    });
    const body = parseToolResult<{ resolved: boolean; listing?: { id: string } }>(res);
    expect(body.resolved).toBe(true);
    expect(body.listing!.id).toBe('21710712');
    expect(offsets).toEqual([0, 50]);
    await h.close();
  });

  it('stops paging once an exact match is found', async () => {
    const offsets: number[] = [];
    const client = routedClient({
      AutocompleteLocations: { data: { autocompleteLocations: { hits: [LOCATION_HIT] } } },
      SearchForSale: (vars) => {
        offsets.push(vars.offset as number);
        return {
          data: { searchForSaleListings: { total: 5000, listings: [HOUSE_CARD, ...filler(49)] } },
        };
      },
    });
    const h = await createTestHarness((s) => registerByAddressTools(s, client));
    const res = await h.callTool('hemnet_get_by_address', {
      address: 'Gäddstigen 1',
      location: 'Södertälje',
    });
    expect(parseToolResult<{ resolved: boolean }>(res).resolved).toBe(true);
    expect(offsets).toEqual([0]);
    await h.close();
  });

  it('caps paging and says the miss is not definitive when the cap cuts it short', async () => {
    const offsets: number[] = [];
    const client = routedClient({
      AutocompleteLocations: { data: { autocompleteLocations: { hits: [LOCATION_HIT] } } },
      SearchForSale: (vars) => {
        const offset = vars.offset as number;
        offsets.push(offset);
        return { data: { searchForSaleListings: { total: 5000, listings: filler(50, offset) } } };
      },
    });
    const h = await createTestHarness((s) => registerByAddressTools(s, client));
    const res = await h.callTool('hemnet_get_by_address', {
      address: 'Gäddstigen 1',
      location: 'Södertälje',
    });
    const body = parseToolResult<{
      resolved: boolean;
      searched: number;
      total: number;
      truncated: boolean;
      error: string;
    }>(res);
    expect(body.resolved).toBe(false);
    expect(body.truncated).toBe(true);
    expect(body.total).toBe(5000);
    expect(body.searched).toBe(offsets.length * 50);
    expect(offsets.length).toBeGreaterThan(1);
    expect(offsets.length).toBeLessThan(100);
    expect(body.error).toContain(`searched ${body.searched} of 5000`);
    expect(body.error).toMatch(/not definitive/);
    await h.close();
  });

  it('stops when a page comes back empty even if total claims more', async () => {
    const offsets: number[] = [];
    const client = routedClient({
      AutocompleteLocations: { data: { autocompleteLocations: { hits: [LOCATION_HIT] } } },
      SearchForSale: (vars) => {
        const offset = vars.offset as number;
        offsets.push(offset);
        const listings = offset === 0 ? filler(50) : [];
        return { data: { searchForSaleListings: { total: 400, listings } } };
      },
    });
    const h = await createTestHarness((s) => registerByAddressTools(s, client));
    const res = await h.callTool('hemnet_get_by_address', {
      address: 'Gäddstigen 1',
      location: 'Södertälje',
    });
    const body = parseToolResult<{ resolved: boolean; searched: number }>(res);
    expect(body.resolved).toBe(false);
    expect(body.searched).toBe(50);
    expect(offsets).toEqual([0, 50]);
    await h.close();
  });
});
