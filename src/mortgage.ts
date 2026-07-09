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
 *   - **Amorteringskrav (amortisation requirement)** — set by LTV, with
 *     a debt-ratio surcharge (Finansinspektionen's rules):
 *       LTV > 70%             → 2% of the loan / year
 *       50% < LTV ≤ 70%       → 1% / year
 *       LTV ≤ 50%             → 0% (base)
 *       loan > 4.5× gross yearly income → +1% / year (skuldkvotsregeln)
 *   - **Kontantinsats (down payment)** — at least 15% of price by law.
 *   - **Avgift (BRF monthly fee)** for `bostadsrätt` apartments, or
 *     **driftkostnad (operating cost)** for houses — a real, large part
 *     of the monthly outlay, so it's a first-class input.
 *   - **Ränteavdrag (interest deduction)** — 30% of interest paid is
 *     tax-deductible up to 100 000 kr/yr of interest, 21% above — so we
 *     report both gross and after-tax monthly cost.
 *
 * All amounts are SEK. The function is pure and deterministic.
 */

/** Legal minimum down payment: 15% of the purchase price. */
export const MIN_DOWN_PAYMENT_FRACTION = 0.15;

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
  /** Down payment as a percent of price (0–100). Defaults to 15%. */
  down_payment_percent?: number;
  /** Monthly BRF fee (avgift) in SEK — for bostadsrätt apartments. */
  monthly_fee?: number;
  /** Monthly operating cost (driftkostnad) in SEK — typically for houses. */
  monthly_operating_cost?: number;
  /** Gross household income per year in SEK — enables the debt-ratio amortisation surcharge. */
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
 * Compute the base amortisation rate from LTV, plus the +1% debt-ratio
 * surcharge when income is known and the loan exceeds 4.5× gross yearly
 * income.
 */
export function amortizationRate(
  loan: number,
  ltv: number,
  grossYearlyIncome?: number,
): number {
  let rate = 0;
  if (ltv > 0.7) rate = 2;
  else if (ltv > 0.5) rate = 1;
  if (
    grossYearlyIncome != null &&
    grossYearlyIncome > 0 &&
    loan > 4.5 * grossYearlyIncome
  ) {
    rate += 1;
  }
  return rate;
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
    amortizationRate(loan, ltv, input.gross_yearly_income);

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
