/**
 * Pure aggregation over a set of sold listings → market statistics.
 *
 * Kept separate from the tool so it's unit-testable without a client and
 * reusable by realty-meta. The arithmetic is realty-core's shared
 * `computeMarketStats` (fleet-audit#1020 — booli carries the same stats over
 * different field names); this file only names Hemnet's fields and keeps the
 * output keys (`median_final_price`, …) exactly as before. Operates on the
 * normalised {@link SoldSummary} shape (kronor + m²), skipping rows where the
 * relevant field is null (or not a finite number) so a sparse dataset still
 * yields honest medians.
 */
import { computeMarketStats as computeSharedMarketStats } from '@chrischall/realty-core';
import type { SoldSummary } from './format.js';

export interface MarketStats {
  sample_size: number;
  median_final_price: number | null;
  average_final_price: number | null;
  median_price_per_sqm: number | null;
  average_price_per_sqm: number | null;
  average_price_change_percent: number | null;
  min_final_price: number | null;
  max_final_price: number | null;
}

export function computeMarketStats(sales: SoldSummary[]): MarketStats {
  const s = computeSharedMarketStats(sales, {
    price: 'final_price',
    pricePerSqm: 'price_per_sqm',
    priceChangePercent: 'price_change_percent',
    priceName: 'final_price',
  });
  // Rebuilt in the documented key order rather than spread, so the public
  // shape is pinned here and not by realty-core's construction order.
  return {
    sample_size: s.sample_size,
    median_final_price: s.median_final_price,
    average_final_price: s.average_final_price,
    median_price_per_sqm: s.median_price_per_sqm,
    average_price_per_sqm: s.average_price_per_sqm,
    average_price_change_percent: s.average_price_change_percent,
    min_final_price: s.min_final_price,
    max_final_price: s.max_final_price,
  };
}
