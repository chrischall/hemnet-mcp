import { describe, it, expect } from 'vitest';
import { createTestHarness, parseToolResult, routedClient } from '../helpers.js';
import { registerListingTools } from '../../src/tools/listings.js';
import { LISTING_DETAIL } from '../fixtures.js';

describe('hemnet_get_listing', () => {
  it('returns a full detail record from a URL', async () => {
    const client = routedClient({ GetListing: { data: { listing: LISTING_DETAIL } } });
    const h = await createTestHarness((s) => registerListingTools(s, client));
    const res = await h.callTool('hemnet_get_listing', {
      id: 'https://www.hemnet.se/bostad/radhus-5rum-pershagen-gaddstigen-1-21710712',
      photo_limit: 3,
    });
    const body = parseToolResult<{ id: string; running_costs_yearly: number }>(res);
    expect(body.id).toBe('21710712');
    expect(body.running_costs_yearly).toBe(46390);
    await h.close();
  });

  it('errors on an unparseable id', async () => {
    const h = await createTestHarness((s) => registerListingTools(s, routedClient({})));
    const res = await h.callTool('hemnet_get_listing', { id: 'not-a-listing' });
    expect(res.isError).toBe(true);
    await h.close();
  });

  it('errors when the listing is not an active for-sale one', async () => {
    const client = routedClient({ GetListing: { data: { listing: null } } });
    const h = await createTestHarness((s) => registerListingTools(s, client));
    const res = await h.callTool('hemnet_get_listing', { id: '21710712' });
    expect(res.isError).toBe(true);
    await h.close();
  });
});
