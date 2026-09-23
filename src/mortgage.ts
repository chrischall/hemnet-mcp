/**
 * Swedish mortgage math (Sweden-specific — deliberately NOT in
 * @chrischall/realty-core, whose `calculateMortgage` models a US PITI
 * loan with property tax + PMI).
 *
 * A Swedish housing cost is structured differently from a US one:
 *
 *   - **Ränta (interest)** — quoted as an annual rate; the monthly
 *     *interest cost* (not an amortising P&I payment) is what buyers
 *     compare. Swedish mortgages are effectively interest-only plus a
 *     legally-mandated amortisation on top.
 *   - **Amorteringskrav (amortisation requirement)** — set by LTV
 *     (Finansinspektionen's rules, as of 1 April 2026):
 *       LTV > 70%             → 2% of the loan / year
 *       50% < LTV ≤ 70%       → 1% / year
 *       LTV ≤ 50%             → 0% (base)
 *     The skärpt amorteringskrav (+1% / year when the loan exceeds 4.5×
 *     gross yearly income) was ABOLISHED on 1 April 2026, so income no
 *     longer affects the rate.
 *   - **Kontantinsats (down payment)** — at least 10% of price by law
 *     (bolånetaket rose from 85% to 90% on 1 April 2026; it was 15%
 *     before that).
 *   - **Avgift (BRF monthly fee)** for `bostadsrätt` apartments, or
 *     **driftkostnad (operating cost)** for houses — a real, large part
 *     of the monthly outlay, so it's a first-class input.
 *   - **Ränteavdrag (interest deduction)** — 30% of interest paid is
 *     tax-deductible up to 100 000 kr/yr of interest, 21% above — so we
 *     report both gross and after-tax monthly cost.
 *
 * All amounts are SEK. The function is pure and deterministic.
 */

/**
 * Legal minimum down payment: 10% of the purchase price (bolånetak 90%,
 * effective 1 April 2026 — previously 15%).
 */
export const MIN_DOWN_PAYMENT_FRACTION = 0.1;

/** Interest-deduction breakpoint: 100 000 kr of interest per year. */
const DEDUCTION_BREAKPOINT_YEARLY = 100_000;
const DEDUCTION_RATE_BELOW = 0.3;
const DEDUCTION_RATE_ABOVE = 0.21;

export interface SwedishMortgageInput {
  /** Purchase price in SEK. */
  price: number;
  /** Annual interest rate as a percent, e.g. 3.5. */
  interest_rate: number;
  /** Down payment in SEK. Provide this OR `down_payment_percent`. */
  down_payment?: number;
  /** Down payment as a percent of price (0–100). Defaults to 10%. */
  down_payment_percent?: number;
  /** Monthly BRF fee (avgift) in SEK — for bostadsrätt apartments. */
  monthly_fee?: number;
  /** Monthly operating cost (driftkostnad) in SEK — typically for houses. */
  monthly_operating_cost?: number;
  /**
   * Gross household income per year in SEK.
   * @deprecated Ignored since the skärpt amorteringskrav (debt-ratio rule)
   * was abolished on 1 April 2026. Kept so existing callers still compile.
   */
  gross_yearly_income?: number;
  /** Override the computed amortisation rate (annual % of loan). */
  amortization_rate?: number;
}

export interface SwedishMortgageBreakdown {
  price: number;
  down_payment: number;
  loan_amount: number;
  ltv: number;
  interest_rate: number;
  amortization_rate: number;
  monthly_interest_gross: number;
  monthly_interest_after_tax: number;
  monthly_amortization: number;
  monthly_fee: number;
  monthly_operating_cost: number;
  monthly_total_gross: number;
  monthly_total_after_tax: number;
  yearly_interest_deduction: number;
}

/** Round to whole kronor. */
function kr(n: number): number {
  return Math.round(n);
}

/**
 * Compute the amortisation rate (annual % of the loan) from LTV.
 *
 * `loan` and `grossYearlyIncome` are unused since the skärpt
 * amorteringskrav (+1% when loan > 4.5× gross income) was abolished on
 * 1 April 2026; they stay in the signature for backward compatibility of
 * this exported helper.
 */
export function amortizationRate(
  _loan: number,
  ltv: number,
  _grossYearlyIncome?: number,
): number {
  if (ltv > 0.7) return 2;
  if (ltv > 0.5) return 1;
  return 0;
}

export function calculateSwedishMortgage(
  input: SwedishMortgageInput,
): SwedishMortgageBreakdown {
  const price = input.price;
  const downPayment =
    input.down_payment ??
    price *
      ((input.down_payment_percent ?? MIN_DOWN_PAYMENT_FRACTION * 100) / 100);
  const loan = Math.max(price - downPayment, 0);
  const ltv = price > 0 ? loan / price : 0;

  const amortRate =
    input.amortization_rate ??
    amortizationRate(loan, ltv);

  const yearlyInterest = loan * (input.interest_rate / 100);
  const monthlyInterestGross = yearlyInterest / 12;

  // Ränteavdrag: 30% up to 100k of interest/yr, 21% on the excess.
  const deductibleBelow = Math.min(yearlyInterest, DEDUCTION_BREAKPOINT_YEARLY);
  const deductibleAbove = Math.max(
    yearlyInterest - DEDUCTION_BREAKPOINT_YEARLY,
    0,
  );
  const yearlyDeduction =
    deductibleBelow * DEDUCTION_RATE_BELOW +
    deductibleAbove * DEDUCTION_RATE_ABOVE;
  const monthlyInterestAfterTax = (yearlyInterest - yearlyDeduction) / 12;

  const monthlyAmortization = (loan * (amortRate / 100)) / 12;
  const monthlyFee = input.monthly_fee ?? 0;
  const monthlyOperating = input.monthly_operating_cost ?? 0;

  const totalGross =
    monthlyInterestGross + monthlyAmortization + monthlyFee + monthlyOperating;
  const totalAfterTax =
    monthlyInterestAfterTax +
    monthlyAmortization +
    monthlyFee +
    monthlyOperating;

  return {
    price: kr(price),
    down_payment: kr(downPayment),
    loan_amount: kr(loan),
    ltv: Math.round(ltv * 1000) / 1000,
    interest_rate: input.interest_rate,
    amortization_rate: amortRate,
    monthly_interest_gross: kr(monthlyInterestGross),
    monthly_interest_after_tax: kr(monthlyInterestAfterTax),
    monthly_amortization: kr(monthlyAmortization),
    monthly_fee: kr(monthlyFee),
    monthly_operating_cost: kr(monthlyOperating),
    monthly_total_gross: kr(totalGross),
    monthly_total_after_tax: kr(totalAfterTax),
    yearly_interest_deduction: kr(yearlyDeduction),
  };
}
