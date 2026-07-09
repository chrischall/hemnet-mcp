/**
 * Swedish money / measurement string parsing.
 *
 * Hemnet's GraphQL surface is inconsistent about number shape: the
 * `ActivePropertyListing` detail node exposes structured `Money`
 * objects (`{ amount: 3995000, formatted: "3 995 000 kr" }`), but the
 * card/list surfaces (`ListingCard`, `SaleCard`) return ONLY the
 * pre-formatted Swedish string — `"3 995 000 kr"`, `"4 689 kr/mån"`,
 * `"92 969 kr/m²"`, `"+3 %"`. Consumers (and especially realty-meta,
 * which needs to compare across portals) want a raw number, so every
 * card field is run back through `parseSekAmount` / `parsePercent`.
 *
 * Swedish formatting uses a space (regular ` `, non-breaking ` `,
 * or narrow-no-break ` `) as the thousands separator and a comma
 * for the decimal point — the opposite of US convention. These helpers
 * are lexical (no `Intl`/locale dependency) so they behave identically
 * regardless of the host's locale, mirroring the fleet's `dates` module
 * philosophy in @chrischall/mcp-utils.
 */

/** Every whitespace variant Hemnet uses as a digit-group separator. */
const GROUP_SEPARATORS = /[\s  ]/g;

/**
 * Parse a Swedish currency string into an integer count of kronor.
 *
 * Handles `"3 995 000 kr"`, `"4 689 kr/mån"`, `"46 390 kr"`,
 * `"92 969 kr/m²"`, and the non-breaking-space variants. Any decimal
 * part (comma-separated, e.g. `"1 234,50 kr"`) is preserved as a float.
 * Returns `null` for `null`/`undefined`/empty/`"–"`-style placeholders
 * or anything with no digits — Hemnet renders missing values as an
 * em dash rather than omitting the field.
 */
export function parseSekAmount(
  value: string | null | undefined,
): number | null {
  if (value == null) return null;
  const cleaned = value.replace(GROUP_SEPARATORS, '').replace(',', '.');
  const match = cleaned.match(/-?\d+(?:\.\d+)?/);
  if (!match) return null;
  // The regex only ever matches a finite numeric literal, so Number() here
  // is always finite — no NaN/Infinity guard needed.
  return Number(match[0]);
}

/**
 * Parse a Swedish integer/measurement string into a number.
 *
 * The card surfaces render sizes and counts as strings too — `"64 m²"`,
 * `"2 rum"`, `"101 m²"`. This strips the unit label and group
 * separators and returns the numeric magnitude (float-aware for
 * `"2,5 rum"`). `null` on no-digit input.
 */
export function parseMeasurement(
  value: string | null | undefined,
): number | null {
  return parseSekAmount(value);
}

/**
 * Parse a Hemnet percent string (`"+3 %"`, `"-5 %"`, `"0 %"`) into a
 * signed number of percentage points. `null` when absent. Used for
 * `SaleCard.priceChange` (asking→final delta) so realty-meta can rank
 * over-/under-asking outcomes numerically.
 */
export function parsePercent(
  value: string | null | undefined,
): number | null {
  return parseSekAmount(value);
}

/**
 * Format an integer kronor amount back into Hemnet's canonical
 * space-grouped string (`3995000` → `"3 995 000 kr"`). Used by the
 * mortgage tool so its SEK outputs read the same as the listing fields.
 * Uses a plain regex grouper (no `Intl`) to stay locale-independent.
 */
export function formatSek(amount: number): string {
  const rounded = Math.round(amount);
  const grouped = String(Math.abs(rounded)).replace(
    /\B(?=(\d{3})+(?!\d))/g,
    ' ',
  );
  return `${rounded < 0 ? '-' : ''}${grouped} kr`;
}
