import { describe, it, expect } from 'vitest';
import { createTestHarness, parseToolResult, routedClient } from '../helpers.js';
import { registerAutocompleteTools } from '../../src/tools/autocomplete.js';
import { LOCATION_HIT } from '../fixtures.js';

describe('hemnet_autocomplete_location', () => {
  it('returns formatted location hits', async () => {
    const client = routedClient({
      AutocompleteLocations: { data: { autocompleteLocations: { hits: [LOCATION_HIT] } } },
    });
    const h = await createTestHarness((s) => registerAutocompleteTools(s, client));
    const res = await h.callTool('hemnet_autocomplete_location', { query: 'Vasastan' });
    const body = parseToolResult<{ count: number; locations: { location_id: string }[] }>(res);
    expect(body.count).toBe(1);
    expect(body.locations[0]!.location_id).toBe('925970');
    await h.close();
  });
});
