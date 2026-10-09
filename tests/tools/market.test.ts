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

  describe('sampling beyond one page (fleet-audit#491)', () => {
    /** A SearchSales route over `total` sales, recording each page request. */
    function pagedSales(total: number) {
      const pages: { limit: number; offset: number }[] = [];
      const route = (vars: Record<string, unknown>) => {
        const limit = vars.limit as number;
        const offset = vars.offset as number;
        pages.push({ limit, offset });
        const n = Math.max(0, Math.min(limit, total - offset));
        return { data: { searchSales: { total, cards: Array(n).fill(SALE_CARD) } } };
      };
      return { pages, route };
    }

    it('pages through up to 200 sales by default, 50 at a time', async () => {
      const { pages, route } = pagedSales(5000);
      const client = routedClient({ SearchSales: route });
      const h = await createTestHarness((s) => registerMarketTools(s, client));
      const res = await h.callTool('hemnet_get_market_stats', { location_ids: ['1'] });
      const body = parseToolResult<{
        total_matching_sales: number;
        sampled_sales: number;
        sample_note: string;
        stats: { sample_size: number };
      }>(res);
      expect(pages).toEqual([
        { limit: 50, offset: 0 },
        { limit: 50, offset: 50 },
        { limit: 50, offset: 100 },
        { limit: 50, offset: 150 },
      ]);
      expect(body.total_matching_sales).toBe(5000);
      expect(body.sampled_sales).toBe(200);
      expect(body.stats.sample_size).toBe(200);
      expect(body.sample_note).toMatch(/most recent 200 of 5000/);
      await h.close();
    });

    it('honours max_sales and stops early once every sale is fetched', async () => {
      const big = pagedSales(5000);
      const h = await createTestHarness((s) =>
        registerMarketTools(s, routedClient({ SearchSales: big.route })),
      );
      await h.callTool('hemnet_get_market_stats', { location_ids: ['1'], max_sales: 70 });
      expect(big.pages).toEqual([
        { limit: 50, offset: 0 },
        { limit: 20, offset: 50 },
      ]);
      await h.close();

      const small = pagedSales(60);
      const h2 = await createTestHarness((s) =>
        registerMarketTools(s, routedClient({ SearchSales: small.route })),
      );
      const res = await h2.callTool('hemnet_get_market_stats', { location_ids: ['1'] });
      const body = parseToolResult<{ sampled_sales: number; sample_note: string }>(res);
      expect(small.pages).toHaveLength(2);
      expect(body.sampled_sales).toBe(60);
      expect(body.sample_note).toMatch(/all 60 matching sales/);
      await h2.close();
    });

    it('stops on a short or empty page before the total is reached', async () => {
      const run = async (firstPage: number) => {
        const pages: number[] = [];
        const client = routedClient({
          SearchSales: (vars) => {
            pages.push(vars.offset as number);
            const n = (vars.offset as number) === 0 ? firstPage : 0;
            return { data: { searchSales: { total: 900, cards: Array(n).fill(SALE_CARD) } } };
          },
        });
        const h = await createTestHarness((s) => registerMarketTools(s, client));
        const res = await h.callTool('hemnet_get_market_stats', { location_ids: ['1'] });
        await h.close();
        return { pages, sampled: parseToolResult<{ sampled_sales: number }>(res).sampled_sales };
      };
      // A short first page ends the listing.
      expect(await run(1)).toEqual({ pages: [0], sampled: 1 });
      // A full first page followed by an empty one.
      expect(await run(50)).toEqual({ pages: [0, 50], sampled: 50 });
    });

    it('labels an OLDEST-sorted sample as the oldest sales', async () => {
      const { route } = pagedSales(5000);
      const h = await createTestHarness((s) =>
        registerMarketTools(s, routedClient({ SearchSales: route })),
      );
      const res = await h.callTool('hemnet_get_market_stats', {
        location_ids: ['1'],
        sort: 'OLDEST',
        max_sales: 10,
      });
      expect(parseToolResult<{ sample_note: string }>(res).sample_note).toMatch(
        /oldest 10 of 5000/,
      );
      await h.close();
    });

    it('does not offer offset/limit pagination', async () => {
      const h = await createTestHarness((s) => registerMarketTools(s, routedClient({})));
      const { tools } = await h.client.listTools();
      const tool = tools.find((t) => t.name === 'hemnet_get_market_stats')!;
      const props = Object.keys(tool.inputSchema.properties ?? {});
      expect(props).not.toContain('offset');
      expect(props).not.toContain('limit');
      expect(props).toContain('max_sales');
      await h.close();
    });
  });
});
