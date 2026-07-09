import { describe, it, expect } from 'vitest';
import { createTestHarness, parseToolResult } from '../helpers.js';
import { registerMortgageTools } from '../../src/tools/mortgage.js';

describe('hemnet_calculate_mortgage', () => {
  it('returns a Swedish monthly cost breakdown', async () => {
    const h = await createTestHarness((s) => registerMortgageTools(s));
    const res = await h.callTool('hemnet_calculate_mortgage', {
      price: 4_000_000,
      interest_rate: 4,
      down_payment: 1_000_000,
      monthly_fee: 3500,
    });
    const body = parseToolResult<{
      loan_amount: number;
      ltv: number;
      monthly_total_gross: number;
      monthly_total_after_tax: number;
    }>(res);
    expect(body.loan_amount).toBe(3_000_000);
    expect(body.ltv).toBe(0.75);
    expect(body.monthly_total_after_tax).toBeLessThan(body.monthly_total_gross);
    await h.close();
  });
});
