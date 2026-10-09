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
      extractListingId('https://www.hemnet.se/bostad/foo-21710712/?utm=1#gallery'),
    ).toBe('21710712');
  });
  it('returns null for empty / non-id input', () => {
    expect(extractListingId('')).toBeNull();
    expect(extractListingId('   ')).toBeNull();
    expect(extractListingId('https://www.hemnet.se/bostader')).toBeNull();
    expect(extractListingId('/')).toBeNull();
  });
});

describe('extractListingId — no misparsed ids (fleet-audit#492)', () => {
  it('rejects a street address instead of reading its house number as an id', () => {
    expect(extractListingId('Storgatan 12')).toBeNull();
    expect(extractListingId('Gaddstigen 1, Pershagen')).toBeNull();
  });
  it('rejects a slug whose trailing digit run is too short to be a listing id', () => {
    expect(extractListingId('storgatan-12')).toBeNull();
    expect(extractListingId('https://www.hemnet.se/bostad/foo-123')).toBeNull();
  });
  it('finds the id on a gallery / sub-path URL by scanning segments right to left', () => {
    expect(
      extractListingId(
        'https://www.hemnet.se/bostad/radhus-5rum-pershagen-gaddstigen-1-21710712/bilder',
      ),
    ).toBe('21710712');
    expect(
      extractListingId('https://www.hemnet.se/bostad/villa-x-21710712/bilder/3?x=1'),
    ).toBe('21710712');
  });
  it('rejects a URL on another host', () => {
    expect(extractListingId('https://example.com/bostad/villa-x-21710712')).toBeNull();
  });
  it('rejects a malformed URL', () => {
    expect(extractListingId('https://[bad/bostad/villa-x-21710712')).toBeNull();
  });
  it('accepts a bare slug and a hemnet.se URL without the www', () => {
    expect(extractListingId('villa-x-21710712')).toBe('21710712');
    expect(extractListingId('https://hemnet.se/bostad/villa-x-21710712')).toBe('21710712');
  });
});

describe('buildListingUrl / buildSoldUrl', () => {
  it('prefixes the Hemnet origin', () => {
    expect(buildListingUrl('foo-1')).toBe(`${HEMNET_ORIGIN}/bostad/foo-1`);
    expect(buildSoldUrl('bar-2')).toBe(`${HEMNET_ORIGIN}/salda/bar-2`);
  });
});
