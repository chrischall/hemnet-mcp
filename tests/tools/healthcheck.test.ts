import { describe, it, expect } from 'vitest';
import { createTestHarness, parseToolResult, fakeClient, fakeTransport } from '../helpers.js';
import { HemnetClient } from '../../src/client.js';
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

  it('gives the browser-bridge hint for a bridge-down error after fallback', async () => {
    // Once the fallback has switched, transport-fetchproxy wraps failures as
    // "Hemnet bridge: …" — the walled hint must catch those too.
    const client = fakeClient(() => {
      throw new Error('Hemnet bridge: fetchproxy bridge down during fetch');
    });
    const h = await createTestHarness((s) => registerHealthcheckTools(s, client));
    const res = await h.callTool('hemnet_healthcheck', {});
    const body = parseToolResult<{ ok: boolean; hint: string }>(res);
    expect(body.ok).toBe(false);
    expect(body.hint).toMatch(/HEMNET_TRANSPORT=fetchproxy/);
    await h.close();
  });
});

describe('hemnet_healthcheck transport reporting', () => {
  it('says which transport served a successful probe', async () => {
    const client = new HemnetClient({
      transport: {
        ...fakeTransport(() => ({
          data: { autocompleteLocations: { hits: [LOCATION_HIT] } },
        })),
        status: () => ({
          transport: 'fetchproxy',
          mode: 'auto',
          bridge: { role: 'host', port: 37150, last_extension_message_at: '2026-09-02T21:58:46.000Z' },
        }),
      },
    });
    const h = await createTestHarness((s) => registerHealthcheckTools(s, client));
    const res = await h.callTool('hemnet_healthcheck', {});
    const body = parseToolResult<{ ok: boolean; transport: unknown }>(res);
    expect(body.ok).toBe(true);
    expect(body.transport).toEqual({
      transport: 'fetchproxy',
      mode: 'auto',
      bridge: { role: 'host', port: 37150, last_extension_message_at: '2026-09-02T21:58:46.000Z' },
    });
    await h.close();
  });

  it('says which transport a failed probe was on, so a bridge that never linked is visible', async () => {
    const client = new HemnetClient({
      transport: {
        ...fakeTransport(() => {
          throw new Error('Hemnet bridge: fetchproxy: no confirmed browser session for "x"');
        }),
        status: () => ({
          transport: 'fetchproxy',
          mode: 'auto',
          bridge: { role: 'host', port: 37150, last_extension_message_at: null },
        }),
      },
    });
    const h = await createTestHarness((s) => registerHealthcheckTools(s, client));
    const res = await h.callTool('hemnet_healthcheck', {});
    const body = parseToolResult<{
      ok: boolean;
      transport: { bridge: { role: string; last_extension_message_at: null } };
    }>(res);
    expect(body.ok).toBe(false);
    expect(body.transport.bridge.role).toBe('host');
    expect(body.transport.bridge.last_extension_message_at).toBeNull();
    await h.close();
  });
});
