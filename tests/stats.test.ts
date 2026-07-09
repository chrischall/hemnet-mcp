import { describe, it, expect } from 'vitest';
import { computeMarketStats } from '../src/stats.js';
import { formatSaleCard } from '../src/format.js';
import { SALE_CARD } from './fixtures.js';
import type { SoldSummary } from '../src/format.js';

function sale(partial: Partial<SoldSummary>): SoldSummary {
  return { ...formatSaleCard(SALE_CARD), ...partial };
}

describe('computeMarketStats', () => {
  it('returns all-null on an empty set', () => {
    expect(computeMarketStats([])).toEqual({
      sample_size: 0,
      median_final_price: null,
      average_final_price: null,
      median_price_per_sqm: null,
      average_price_per_sqm: null,
      average_price_change_percent: null,
      min_final_price: null,
      max_final_price: null,
    });
  });

  it('computes an odd-length median', () => {
    const s = computeMarketStats([
      sale({ final_price: 1_000_000, price_per_sqm: 10000, price_change_percent: 1 }),
      sale({ final_price: 2_000_000, price_per_sqm: 20000, price_change_percent: 3 }),
      sale({ final_price: 3_000_000, price_per_sqm: 30000, price_change_percent: 5 }),
    ]);
    expect(s.sample_size).toBe(3);
    expect(s.median_final_price).toBe(2_000_000);
    expect(s.average_final_price).toBe(2_000_000);
    expect(s.median_price_per_sqm).toBe(20000);
    expect(s.average_price_change_percent).toBe(3);
    expect(s.min_final_price).toBe(1_000_000);
    expect(s.max_final_price).toBe(3_000_000);
  });

  it('computes an even-length median and skips null fields', () => {
    const s = computeMarketStats([
      sale({ final_price: 1_000_000, price_per_sqm: null, price_change_percent: null }),
      sale({ final_price: 3_000_000, price_per_sqm: 30000, price_change_percent: 2 }),
    ]);
    expect(s.median_final_price).toBe(2_000_000);
    expect(s.median_price_per_sqm).toBe(30000); // only one non-null
    expect(s.average_price_change_percent).toBe(2);
  });
});
