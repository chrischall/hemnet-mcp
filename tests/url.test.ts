import { describe, it, expect } from 'vitest';
import {
  extractListingId,
  buildListingUrl,
  buildSoldUrl,
  HEMNET_ORIGIN,
} from '../src/url.js';

describe('extractListingId', () => {
  it('returns a bare numeric id unchanged', () => {
    expect(extractListingId('21710712')).toBe('21710712');
  });
  it('extracts the trailing id from a for-sale URL', () => {
    expect(
      extractListingId(
        'https://www.hemnet.se/bostad/radhus-5rum-pershagen-gaddstigen-1-21710712',
      ),
    ).toBe('21710712');
  });
  it('extracts the trailing id from a sold URL', () => {
    expect(
      extractListingId(
        'https://www.hemnet.se/salda/lagenhet-2rum-x-6254767670540539069',
      ),
    ).toBe('6254767670540539069');
  });
  it('strips query and fragment and trailing slash', () => {
    expect(
      extractListingId('https://www.hemnet.se/bostad/foo-123/?utm=1#gallery'),
    ).toBe('123');
  });
  it('returns null for empty / non-id input', () => {
    expect(extractListingId('')).toBeNull();
    expect(extractListingId('   ')).toBeNull();
    expect(extractListingId('https://www.hemnet.se/bostader')).toBeNull();
    expect(extractListingId('/')).toBeNull();
  });
});

describe('buildListingUrl / buildSoldUrl', () => {
  it('prefixes the Hemnet origin', () => {
    expect(buildListingUrl('foo-1')).toBe(`${HEMNET_ORIGIN}/bostad/foo-1`);
    expect(buildSoldUrl('bar-2')).toBe(`${HEMNET_ORIGIN}/salda/bar-2`);
  });
});
