import { describe, it, expect } from 'vitest';
import {
  createHemnetClient,
  HemnetClient,
  DirectTransport,
  computeMarketStats,
  calculateSwedishMortgage,
  formatListingCard,
  extractListingId,
  HOUSING_FORM_GROUPS,
  SORT_OPTIONS,
} from '../src/lib.js';

describe('lib entry point', () => {
  it('createHemnetClient builds a client over a DirectTransport', () => {
    const client = createHemnetClient({ version: '9.9.9' });
    expect(client).toBeInstanceOf(HemnetClient);
  });

  it('re-exports the public surface realty-meta consumes', () => {
    expect(new DirectTransport()).toBeInstanceOf(DirectTransport);
    expect(typeof computeMarketStats).toBe('function');
    expect(typeof calculateSwedishMortgage).toBe('function');
    expect(typeof formatListingCard).toBe('function');
    expect(extractListingId('foo-42')).toBe('42');
    expect(HOUSING_FORM_GROUPS).toContain('APARTMENTS');
    expect(SORT_OPTIONS).toContain('NEWEST');
  });
});
