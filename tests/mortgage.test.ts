import { describe, it, expect } from 'vitest';
import {
  calculateSwedishMortgage,
  amortizationRate,
  MIN_DOWN_PAYMENT_FRACTION,
} from '../src/mortgage.js';

describe('amortizationRate', () => {
  it('is 2% above 70% LTV', () => {
    expect(amortizationRate(800_000, 0.8)).toBe(2);
  });
  it('is 1% between 50% and 70% LTV', () => {
    expect(amortizationRate(600_000, 0.6)).toBe(1);
  });
  it('is 0% at or below 50% LTV', () => {
    expect(amortizationRate(400_000, 0.4)).toBe(0);
  });
  it('adds the +1% debt-ratio surcharge when loan > 4.5x income', () => {
    expect(amortizationRate(5_000_000, 0.8, 1_000_000)).toBe(3);
  });
  it('does not add the surcharge for a modest debt ratio', () => {
    expect(amortizationRate(3_000_000, 0.8, 1_000_000)).toBe(2);
  });
});

describe('calculateSwedishMortgage', () => {
  it('defaults the down payment to the legal 15% minimum', () => {
    const m = calculateSwedishMortgage({ price: 1_000_000, interest_rate: 3 });
    expect(m.down_payment).toBe(150_000);
    expect(m.loan_amount).toBe(850_000);
    expect(m.ltv).toBe(0.85);
    expect(m.amortization_rate).toBe(2);
    expect(MIN_DOWN_PAYMENT_FRACTION).toBe(0.15);
  });

  it('honours an explicit down payment and fee/operating costs', () => {
    const m = calculateSwedishMortgage({
      price: 4_000_000,
      interest_rate: 4,
      down_payment: 2_000_000,
      monthly_fee: 3000,
      monthly_operating_cost: 1500,
    });
    expect(m.loan_amount).toBe(2_000_000);
    expect(m.ltv).toBe(0.5);
    expect(m.amortization_rate).toBe(0); // exactly 50% → base
    // interest 2M * 4% / 12 = 6666.67 → 6667
    expect(m.monthly_interest_gross).toBe(6667);
    expect(m.monthly_fee).toBe(3000);
    expect(m.monthly_operating_cost).toBe(1500);
    expect(m.monthly_total_gross).toBe(
      m.monthly_interest_gross + m.monthly_amortization + 3000 + 1500,
    );
  });

  it('honours a down_payment_percent', () => {
    const m = calculateSwedishMortgage({
      price: 2_000_000,
      interest_rate: 3,
      down_payment_percent: 25,
    });
    expect(m.down_payment).toBe(500_000);
  });

  it('applies the interest deduction below and above the 100k breakpoint', () => {
    // Small loan: all interest below breakpoint → 30% deduction.
    const small = calculateSwedishMortgage({
      price: 1_000_000,
      interest_rate: 3,
      down_payment: 500_000,
    });
    // yearly interest = 500k * 3% = 15000; deduction 30% = 4500.
    expect(small.yearly_interest_deduction).toBe(4500);
    expect(small.monthly_interest_after_tax).toBe(Math.round((15000 - 4500) / 12));

    // Large loan: interest crosses the breakpoint → 30% + 21% split.
    const large = calculateSwedishMortgage({
      price: 20_000_000,
      interest_rate: 5,
      down_payment: 5_000_000,
    });
    // yearly interest = 15M * 5% = 750000; deduction = 100000*0.3 + 650000*0.21.
    expect(large.yearly_interest_deduction).toBe(
      Math.round(100_000 * 0.3 + 650_000 * 0.21),
    );
  });

  it('allows overriding the amortisation rate', () => {
    const m = calculateSwedishMortgage({
      price: 1_000_000,
      interest_rate: 3,
      amortization_rate: 5,
    });
    expect(m.amortization_rate).toBe(5);
  });

  it('handles a zero price without dividing by zero', () => {
    const m = calculateSwedishMortgage({ price: 0, interest_rate: 3 });
    expect(m.ltv).toBe(0);
    expect(m.loan_amount).toBe(0);
  });
});
