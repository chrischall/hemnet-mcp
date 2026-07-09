import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { textResult } from '../mcp.js';
import { calculateSwedishMortgage } from '../mortgage.js';

/**
 * `hemnet_calculate_mortgage` — local-only Swedish mortgage cost.
 *
 * No network. Models the Swedish monthly housing cost: interest +
 * legally-mandated amortisation (amorteringskrav, derived from LTV and an
 * optional debt-ratio surcharge) + BRF fee/operating cost, and reports
 * both gross and after-tax (ränteavdrag) totals. See src/mortgage.ts for
 * the rules.
 */
export function registerMortgageTools(server: McpServer): void {
  server.registerTool(
    'hemnet_calculate_mortgage',
    {
      title: 'Calculate a Swedish monthly mortgage cost',
      description:
        'Local-only Swedish mortgage calculator (all amounts SEK). Returns the monthly cost broken into interest, mandated amortisation (amorteringskrav from LTV + a debt-ratio surcharge when income is given), BRF fee (avgift), and operating cost — with both gross and after-tax (ränteavdrag) totals. Provide `down_payment` OR `down_payment_percent` (defaults to the legal 15% minimum). No network call.',
      annotations: {
        title: 'Calculate a Swedish monthly mortgage cost',
        readOnlyHint: true,
        idempotentHint: true,
        openWorldHint: false,
      },
      inputSchema: {
        price: z.number().positive().describe('Purchase price in SEK.'),
        interest_rate: z
          .number()
          .nonnegative()
          .describe('Annual interest rate %, e.g. 3.5'),
        down_payment: z.number().nonnegative().optional().describe('SEK'),
        down_payment_percent: z
          .number()
          .min(0)
          .max(100)
          .optional()
          .describe('Percent of price; defaults to the legal 15% minimum.'),
        monthly_fee: z
          .number()
          .nonnegative()
          .optional()
          .describe('BRF monthly fee (avgift) in SEK — for bostadsrätt apartments.'),
        monthly_operating_cost: z
          .number()
          .nonnegative()
          .optional()
          .describe('Monthly operating cost (driftkostnad) in SEK — typically houses.'),
        gross_yearly_income: z
          .number()
          .nonnegative()
          .optional()
          .describe('Gross household income/year in SEK — enables the +1% debt-ratio amortisation surcharge.'),
        amortization_rate: z
          .number()
          .nonnegative()
          .optional()
          .describe('Override the computed amortisation rate (annual % of loan).'),
      },
    },
    async (input) => textResult(calculateSwedishMortgage(input)),
  );
}
