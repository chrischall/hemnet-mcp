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
 * ids are 18–19 digits — both are the trailing digit run of the slug.
 */

export const HEMNET_ORIGIN = 'https://www.hemnet.se';

/**
 * Minimum digits for an id read out of a slug. Active-listing ids are ~8
 * digits and sale ids 18–19, so a shorter trailing run (`storgatan-12`) is a
 * house number, not an id (fleet-audit#492).
 */
const MIN_SLUG_ID_DIGITS = 6;

/** A slug segment ending in `-<id>`; captures the id. */
const SLUG_ID = new RegExp(`^\\S*-(\\d{${MIN_SLUG_ID_DIGITS},})$`);

/**
 * Extract the numeric Hemnet listing/sale id from a full URL, a bare
 * slug, or the id itself.
 *
 * A bare all-digit string is taken as the id. Otherwise the input must be
 * a Hemnet URL (any `hemnet.se` host) or a path/slug: `?query` and
 * `#fragment` are stripped and the path segments are scanned right to left
 * for the first `…-<6+ digits>` slug, so a gallery sub-path
 * (`…-21710712/bilder`) still resolves. Returns `null` when there is no
 * plausible id — a street address like `Storgatan 12`, a short trailing
 * number, or another site's URL — so callers can surface a clean argument
 * error rather than firing a doomed (or wrong) GraphQL query.
 */
export function extractListingId(urlOrId: string): string | null {
  const trimmed = urlOrId.trim();
  if (trimmed === '') return null;
  // A bare id: all digits.
  if (/^\d+$/.test(trimmed)) return trimmed;

  let path = trimmed;
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)) {
    let url: URL;
    try {
      url = new URL(trimmed);
    } catch {
      return null;
    }
    const host = url.hostname.toLowerCase();
    if (host !== 'hemnet.se' && !host.endsWith('.hemnet.se')) return null;
    path = url.pathname;
  } else {
    // `String.split` always returns at least one element, so `[0]` is a string.
    path = trimmed.split(/[?#]/)[0]!;
  }

  const segments = path.split('/').filter((s) => s.length > 0);
  for (let i = segments.length - 1; i >= 0; i--) {
    const match = segments[i]!.match(SLUG_ID);
    if (match) return match[1]!;
  }
  return null;
}

/** Build the canonical for-sale detail URL from a listing slug. */
export function buildListingUrl(slug: string): string {
  return `${HEMNET_ORIGIN}/bostad/${slug}`;
}

/** Build the canonical sold-sale detail URL from a sale slug. */
export function buildSoldUrl(slug: string): string {
  return `${HEMNET_ORIGIN}/salda/${slug}`;
}
