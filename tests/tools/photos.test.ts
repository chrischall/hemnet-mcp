import { describe, it, expect } from 'vitest';
import { createTestHarness, parseToolResult, routedClient } from '../helpers.js';
import { registerPhotosTools } from '../../src/tools/photos.js';
import { LISTING_DETAIL } from '../fixtures.js';

describe('hemnet_get_listing_photos', () => {
  it('returns filtered photo URLs and count', async () => {
    const client = routedClient({ GetListing: { data: { listing: LISTING_DETAIL } } });
    const h = await createTestHarness((s) => registerPhotosTools(s, client));
    const res = await h.callTool('hemnet_get_listing_photos', { id: '21710712' });
    const body = parseToolResult<{ photo_count: number; photos: string[] }>(res);
    expect(body.photo_count).toBe(43);
    expect(body.photos).toHaveLength(2); // null url filtered out
    await h.close();
  });

  it('handles a listing with no images block', async () => {
    const client = routedClient({
      GetListing: { data: { listing: { __typename: 'ActivePropertyListing', id: '1' } } },
    });
    const h = await createTestHarness((s) => registerPhotosTools(s, client));
    const res = await h.callTool('hemnet_get_listing_photos', { id: '1' });
    const body = parseToolResult<{ photo_count: number; photos: string[] }>(res);
    expect(body.photos).toEqual([]);
    expect(body.photo_count).toBe(0);
    await h.close();
  });

  it('errors on an unparseable id', async () => {
    const h = await createTestHarness((s) => registerPhotosTools(s, routedClient({})));
    const res = await h.callTool('hemnet_get_listing_photos', { id: 'nope' });
    expect(res.isError).toBe(true);
    await h.close();
  });

  it('errors when nothing is found', async () => {
    const client = routedClient({ GetListing: { data: { listing: null } } });
    const h = await createTestHarness((s) => registerPhotosTools(s, client));
    const res = await h.callTool('hemnet_get_listing_photos', { id: '1' });
    expect(res.isError).toBe(true);
    await h.close();
  });
});
