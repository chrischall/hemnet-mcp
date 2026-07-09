/**
 * Hemnet URL helpers.
 *
 * Hemnet listing pages are addressed by a numeric id embedded as the
 * final hyphen-delimited segment of a slug:
 *
 *   for-sale: https://www.hemnet.se/bostad/radhus-5rum-…-gaddstigen-1-21710712
 *   sold:     https://www.hemnet.se/salda/lagenhet-2rum-…-nordenflychtsvagen-64-6254767670540539069
 *
 * The GraphQL API keys everything off that bare id (`listing(id:)`,
 * `soldListing(id:)`), so every tool that accepts a `url` from the user
 * reduces it to the id first. Active-listing ids are ~8 digits; sold-sale
 * ids are 18–19 digits — both are just the trailing digit run.
 */

export const HEMNET_ORIGIN = 'https://www.hemnet.se';

/**
 * Extract the numeric Hemnet listing/sale id from a full URL, a bare
 * slug, or the id itself. Strips `?query` and `#fragment`, drops any
 * trailing slash, and takes the final run of digits after the last
 * hyphen. Returns `null` when there is no plausible id (no trailing
 * digit group) so callers can surface a clean argument error rather than
 * firing a doomed GraphQL query.
 */
export function extractListingId(urlOrId: string): string | null {
  const trimmed = urlOrId.trim();
  if (trimmed === '') return null;
  // A bare id: all digits.
  if (/^\d+$/.test(trimmed)) return trimmed;
  // Strip query/fragment, then take the last non-empty path segment.
  // `String.split` always returns at least one element, so `[0]` is a string.
  const noQuery = trimmed.split(/[?#]/)[0]!;
  const segments = noQuery.split('/').filter((s) => s.length > 0);
  const last = segments[segments.length - 1];
  if (last === undefined) return null;
  // The id is the trailing digit group after the final hyphen.
  const match = last.match(/(\d+)$/);
  return match ? match[1]! : null;
}

/** Build the canonical for-sale detail URL from a listing slug. */
export function buildListingUrl(slug: string): string {
  return `${HEMNET_ORIGIN}/bostad/${slug}`;
}

/** Build the canonical sold-sale detail URL from a sale slug. */
export function buildSoldUrl(slug: string): string {
  return `${HEMNET_ORIGIN}/salda/${slug}`;
}
