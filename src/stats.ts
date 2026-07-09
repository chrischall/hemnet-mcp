/**
 * Pure aggregation over a set of sold listings → market statistics.
 *
 * Kept separate from the tool so it's unit-testable without a client and
 * reusable by realty-meta. Operates on the normalised {@link SoldSummary}
 * shape (kronor + m²), skipping rows where the relevant field is null so
 * a sparse dataset still yields honest medians.
 */
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

/** Median of a numeric array (already length-checked by the caller). */
function median(nums: number[]): number {
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1]! + sorted[mid]!) / 2
    : sorted[mid]!;
}

function mean(nums: number[]): number {
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

/** Pull the non-null values of one numeric field out of the sold rows. */
function column(sales: SoldSummary[], key: keyof SoldSummary): number[] {
  return sales
    .map((s) => s[key])
    .filter((v): v is number => typeof v === 'number');
}

export function computeMarketStats(sales: SoldSummary[]): MarketStats {
  const finals = column(sales, 'final_price');
  const perSqm = column(sales, 'price_per_sqm');
  const changes = column(sales, 'price_change_percent');
  return {
    sample_size: sales.length,
    median_final_price: finals.length ? Math.round(median(finals)) : null,
    average_final_price: finals.length ? Math.round(mean(finals)) : null,
    median_price_per_sqm: perSqm.length ? Math.round(median(perSqm)) : null,
    average_price_per_sqm: perSqm.length ? Math.round(mean(perSqm)) : null,
    average_price_change_percent: changes.length
      ? Math.round(mean(changes) * 10) / 10
      : null,
    min_final_price: finals.length ? Math.min(...finals) : null,
    max_final_price: finals.length ? Math.max(...finals) : null,
  };
}
