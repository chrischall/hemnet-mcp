import { describe, it, expect } from 'vitest';
import { createTestHarness, parseToolResult, fakeTransport } from '../helpers.js';
import { HemnetClient } from '../../src/client.js';
import { registerCompareTools } from '../../src/tools/compare.js';
import { LISTING_DETAIL } from '../fixtures.js';

describe('hemnet_compare_listings', () => {
  it('captures per-row outcomes: ok, unparseable, not-found, error', async () => {
    const transport = fakeTransport((_q, vars) => {
      const id = vars.id;
      if (id === '21710712') return { data: { listing: LISTING_DETAIL } };
      if (id === '99') return { data: { listing: null } };
      return { errors: [{ message: 'boom' }] }; // id '500'
    });
    const client = new HemnetClient({ transport });
    const h = await createTestHarness((s) => registerCompareTools(s, client));
    const res = await h.callTool('hemnet_compare_listings', {
      ids: ['21710712', 'no-digits', '99', '500'],
    });
    const body = parseToolResult<{
      count: number;
      results: { input: string; listing?: unknown; error?: string }[];
    }>(res);
    expect(body.count).toBe(4);
    expect(body.results[0]!.listing).toBeTruthy();
    expect(body.results[1]!.error).toMatch(/parse/);
    expect(body.results[2]!.error).toMatch(/sold/);
    expect(body.results[3]!.error).toMatch(/boom/);
    await h.close();
  });
});
