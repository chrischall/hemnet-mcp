import { describe, it, expect } from 'vitest';
import { HemnetClient } from '../src/client.js';
import { fakeClient, fakeBridgeTransport } from './helpers.js';
import { LISTING_DETAIL, SOLD_DETAIL, LOCATION_HIT, LISTING_CARD, SALE_CARD } from './fixtures.js';

describe('HemnetClient.run error handling', () => {
  it('throws a redacted error on a GraphQL errors array', async () => {
    const client = fakeClient(() => ({ errors: [{ message: 'bad field' }] }));
    await expect(client.autocompleteLocations('x', 1)).rejects.toThrow(
      /Hemnet GraphQL error: bad field/,
    );
  });
  it('throws on an empty (null data) envelope', async () => {
    const client = fakeClient(() => ({ data: null }));
    await expect(client.autocompleteLocations('x', 1)).rejects.toThrow(
      /empty response/,
    );
  });
});

describe('HemnetClient.autocompleteLocations', () => {
  it('returns hits', async () => {
    const client = fakeClient(() => ({
      data: { autocompleteLocations: { hits: [LOCATION_HIT] } },
    }));
    expect(await client.autocompleteLocations('Vasastan', 5)).toEqual([LOCATION_HIT]);
  });
  it('returns [] when hits is null or the field is null', async () => {
    expect(
      await fakeClient(() => ({
        data: { autocompleteLocations: { hits: null } },
      })).autocompleteLocations('x', 1),
    ).toEqual([]);
    expect(
      await fakeClient(() => ({ data: { autocompleteLocations: null } })).autocompleteLocations('x', 1),
    ).toEqual([]);
  });
});

describe('HemnetClient.searchForSale / searchSales', () => {
  it('returns total + listings', async () => {
    const client = fakeClient(() => ({
      data: { searchForSaleListings: { total: 34, listings: [LISTING_CARD] } },
    }));
    const r = await client.searchForSale({ locationIds: ['1'] }, { limit: 2, offset: 0, sort: 'OLDEST' });
    expect(r.total).toBe(34);
    expect(r.listings).toHaveLength(1);
  });
  it('defaults on a null result / null listings', async () => {
    expect(
      await fakeClient(() => ({ data: { searchForSaleListings: null } })).searchForSale({ locationIds: ['1'] }),
    ).toEqual({ total: 0, listings: [] });
    expect(
      await fakeClient(() => ({ data: { searchForSaleListings: { total: 5, listings: null } } })).searchForSale({ locationIds: ['1'] }),
    ).toEqual({ total: 5, listings: [] });
  });
  it('returns sold cards and defaults', async () => {
    const withCards = fakeClient(() => ({
      data: { searchSales: { total: 9, cards: [SALE_CARD] } },
    }));
    expect((await withCards.searchSales({ locationIds: ['1'] })).total).toBe(9);
    expect(
      await fakeClient(() => ({ data: { searchSales: null } })).searchSales({ locationIds: ['1'] }),
    ).toEqual({ total: 0, cards: [] });
    expect(
      await fakeClient(() => ({ data: { searchSales: { total: 2, cards: null } } })).searchSales({ locationIds: ['1'] }),
    ).toEqual({ total: 2, cards: [] });
  });
});

describe('HemnetClient.getListing / getSoldListing', () => {
  it('returns an ActivePropertyListing node', async () => {
    const node = { __typename: 'ActivePropertyListing', ...LISTING_DETAIL };
    const client = fakeClient(() => ({ data: { listing: node } }));
    expect(await client.getListing('21710712')).toMatchObject({ id: LISTING_DETAIL.id });
  });
  it('returns null for a missing or non-active node', async () => {
    expect(await fakeClient(() => ({ data: { listing: null } })).getListing('1')).toBeNull();
    expect(
      await fakeClient(() => ({ data: { listing: { __typename: 'ProjectListing', id: '1' } } })).getListing('1'),
    ).toBeNull();
  });
  it('returns a SoldPropertyListing node', async () => {
    const client = fakeClient(() => ({ data: { soldListing: SOLD_DETAIL } }));
    expect(await client.getSoldListing('x')).toMatchObject({ id: SOLD_DETAIL.id });
  });
  it('returns null for a missing or non-sold node', async () => {
    expect(await fakeClient(() => ({ data: { soldListing: null } })).getSoldListing('1')).toBeNull();
    expect(
      await fakeClient(() => ({ data: { soldListing: { __typename: 'X', id: '1' } } })).getSoldListing('1'),
    ).toBeNull();
  });
});

describe('HemnetClient.healthcheck', () => {
  it('reports ok + hit count', async () => {
    const client = fakeClient(() => ({
      data: { autocompleteLocations: { hits: [LOCATION_HIT] } },
    }));
    expect(await client.healthcheck()).toEqual({ ok: true, hits: 1 });
  });
});

describe('HemnetClient constructor', () => {
  it('accepts an explicit transport', () => {
    const client = new HemnetClient({
      transport: { graphql: async () => ({ data: {} }) },
    });
    expect(client).toBeInstanceOf(HemnetClient);
  });
});

describe('HemnetClient.transportStatus', () => {
  it('returns the transport status when the transport reports one', () => {
    const client = new HemnetClient({
      transport: {
        graphql: async () => ({ data: null }),
        status: () => ({ transport: 'direct', mode: 'auto' }),
      },
    });
    expect(client.transportStatus()).toEqual({ transport: 'direct', mode: 'auto' });
  });

  it('returns undefined for a transport without status()', () => {
    const client = fakeClient(() => ({ data: null }));
    expect(client.transportStatus()).toBeUndefined();
  });
});

describe('HemnetClient.bridgeTransport', () => {
  it('returns the bridge transport when the transport exposes one', () => {
    const bridgeTransport = fakeBridgeTransport();
    const client = new HemnetClient({
      transport: {
        graphql: async () => ({ data: null }),
        bridgeTransport: () => bridgeTransport,
      },
    });
    expect(client.bridgeTransport()).toBe(bridgeTransport);
  });

  it('returns undefined for a transport without bridgeTransport()', () => {
    const client = fakeClient(() => ({ data: null }));
    expect(client.bridgeTransport()).toBeUndefined();
  });
});
