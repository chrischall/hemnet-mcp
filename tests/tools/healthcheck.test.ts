import { describe, it, expect } from 'vitest';
import { createTestHarness, parseToolResult, fakeClient } from '../helpers.js';
import { registerHealthcheckTools } from '../../src/tools/healthcheck.js';
import { LOCATION_HIT } from '../fixtures.js';

describe('hemnet_healthcheck', () => {
  it('reports ok when the endpoint responds', async () => {
    const client = fakeClient(() => ({
      data: { autocompleteLocations: { hits: [LOCATION_HIT] } },
    }));
    const h = await createTestHarness((s) => registerHealthcheckTools(s, client));
    const res = await h.callTool('hemnet_healthcheck', {});
    const body = parseToolResult<{ ok: boolean; hits: number }>(res);
    expect(body.ok).toBe(true);
    expect(body.hits).toBe(1);
    await h.close();
  });

  it('reports not-ok with the error when the endpoint fails', async () => {
    const client = fakeClient(() => ({ errors: [{ message: 'endpoint down' }] }));
    const h = await createTestHarness((s) => registerHealthcheckTools(s, client));
    const res = await h.callTool('hemnet_healthcheck', {});
    const body = parseToolResult<{ ok: boolean; error: string }>(res);
    expect(body.ok).toBe(false);
    expect(body.error).toMatch(/endpoint down/);
    await h.close();
  });
});
