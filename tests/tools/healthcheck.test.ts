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
    const body = parseToolResult<{ ok: boolean; error: string; hint: string }>(res);
    expect(body.ok).toBe(false);
    expect(body.error).toMatch(/endpoint down/);
    expect(body.hint).toMatch(/network reachability/);
    await h.close();
  });

  it('gives the browser-bridge hint when Hemnet serves a Cloudflare challenge', async () => {
    const client = fakeClient(() => {
      throw new Error('Hemnet GraphQL HTTP 403 — Cloudflare bot challenge');
    });
    const h = await createTestHarness((s) => registerHealthcheckTools(s, client));
    const res = await h.callTool('hemnet_healthcheck', {});
    const body = parseToolResult<{ ok: boolean; hint: string }>(res);
    expect(body.ok).toBe(false);
    expect(body.hint).toMatch(/HEMNET_TRANSPORT=fetchproxy/);
    expect(body.hint).toMatch(/tab open/);
    await h.close();
  });
});
