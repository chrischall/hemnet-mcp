import { describe, it, expect } from 'vitest';
import { FetchproxySessionNotReadyError } from '@chrischall/mcp-utils/fetchproxy';
import {
  createTestHarness,
  parseToolResult,
  fakeClient,
  fakeTransport,
  fakeBridge,
  fakeBridgeHealth,
  fakeBridgeTransport,
} from '../helpers.js';
import { HemnetClient } from '../../src/client.js';
import { CloudflareChallengeError } from '../../src/transport-direct.js';
import { HemnetFetchproxyTransport } from '../../src/transport-fetchproxy.js';
import type { HemnetTransport } from '../../src/transport.js';
import { registerHealthcheckTools } from '../../src/tools/healthcheck.js';
import { LOCATION_HIT } from '../fixtures.js';

interface HealthcheckBody {
  ok: boolean;
  transport?: { transport: string; mode?: string };
  bridge?: {
    role: string | null;
    port: number;
    session_state?: string;
    pending_pair_code?: string | null;
    extension_connected?: boolean;
    last_extension_message_at: number | null;
  };
  probe: { url: string; elapsed_ms: number; status?: number; body_length?: number };
  error?: { kind: string; message: string };
  hint: string;
}

const OK_ENVELOPE = { data: { autocompleteLocations: { hits: [LOCATION_HIT] } } };

async function runHealthcheck(transport: HemnetTransport): Promise<HealthcheckBody> {
  const client = new HemnetClient({ transport });
  const h = await createTestHarness((s) => registerHealthcheckTools(s, client));
  try {
    return parseToolResult<HealthcheckBody>(await h.callTool('hemnet_healthcheck', {}));
  } finally {
    await h.close();
  }
}

describe('hemnet_healthcheck probe', () => {
  it('fails a 200 with zero autocomplete hits instead of calling it healthy (#56)', async () => {
    const body = await runHealthcheck({
      ...fakeTransport(() => ({ data: { autocompleteLocations: { hits: [] } } })),
      status: () => ({ transport: 'direct', mode: 'auto' }),
    });
    expect(body.ok).toBe(false);
    expect(body.error?.message).toMatch(/returned 0 hits/);
  });
});

describe('hemnet_healthcheck on the direct path', () => {
  it('reports ok with the direct path, the probe status, and no bridge block', async () => {
    const body = await runHealthcheck({
      ...fakeTransport(() => OK_ENVELOPE),
      status: () => ({ transport: 'direct', mode: 'auto' }),
    });
    expect(body.ok).toBe(true);
    expect(body.transport).toEqual({ transport: 'direct', mode: 'auto' });
    expect(body.bridge).toBeUndefined();
    expect(body.probe.url).toBe('https://www.hemnet.se/graphql');
    expect(body.probe.status).toBe(200);
    // The probe body is the client's serialised healthcheck result.
    expect(body.probe.body_length).toBe(JSON.stringify({ ok: true, hits: 1 }).length);
    expect(body.hint).toMatch(/Direct fetch round-tripped/);
  });

  it('classifies a Cloudflare challenge with the browser-bridge hint', async () => {
    const body = await runHealthcheck({
      ...fakeTransport(() => {
        throw new CloudflareChallengeError('Hemnet GraphQL HTTP 403 — Cloudflare bot challenge');
      }),
      status: () => ({ transport: 'direct', mode: 'direct' }),
    });
    expect(body.ok).toBe(false);
    expect(body.transport?.transport).toBe('direct');
    expect(body.error?.kind).toBe('cloudflare_challenge');
    expect(body.error?.message).toMatch(/Cloudflare bot challenge/);
    expect(body.hint).toMatch(/HEMNET_TRANSPORT=fetchproxy/);
    expect(body.hint).toMatch(/www\.hemnet\.se tab open \(no login needed\)/);
    expect(body.hint).toMatch(/Transporter pairing prompt/);
    expect(body.probe.status).toBeUndefined();
  });

  it('keeps the shared direct-leg hint for a plain GraphQL failure', async () => {
    const body = await runHealthcheck({
      ...fakeTransport(() => ({ errors: [{ message: 'endpoint down' }] })),
      status: () => ({ transport: 'direct', mode: 'auto' }),
    });
    expect(body.ok).toBe(false);
    expect(body.error?.kind).toBe('unknown');
    expect(body.error?.message).toMatch(/endpoint down/);
    expect(body.hint).toMatch(/ran over the direct fetch/);
  });

  it('reports the path as unknown when the transport has no status()', async () => {
    const client = fakeClient(() => OK_ENVELOPE);
    const h = await createTestHarness((s) => registerHealthcheckTools(s, client));
    const body = parseToolResult<HealthcheckBody>(await h.callTool('hemnet_healthcheck', {}));
    await h.close();
    expect(body.ok).toBe(true);
    expect(body.transport).toEqual({ transport: 'unknown', mode: 'auto' });
    expect(body.bridge).toBeUndefined();
  });

  it('leaves a non-Error throw to the shared classifier', async () => {
    const body = await runHealthcheck({
      ...fakeTransport(() => {
        // eslint-disable-next-line @typescript-eslint/only-throw-error
        throw 'boom';
      }),
      status: () => ({ transport: 'direct', mode: 'direct' }),
    });
    expect(body.ok).toBe(false);
    expect(body.error?.kind).toBe('unknown');
  });
});

describe('hemnet_healthcheck on the fetchproxy path', () => {
  it('reports the bridge block, including the extension link state, once a bridge exists', async () => {
    const health = fakeBridgeHealth({
      role: 'host',
      lastExtensionMessageAt: 1_756_850_000_000,
      session: { state: 'linked', pairCode: null, extensionConnected: true },
    });
    const body = await runHealthcheck({
      ...fakeTransport(() => OK_ENVELOPE),
      status: () => ({ transport: 'fetchproxy', mode: 'auto' }),
      bridgeTransport: () => fakeBridgeTransport(health),
    });
    expect(body.ok).toBe(true);
    expect(body.transport).toEqual({ transport: 'fetchproxy', mode: 'auto' });
    expect(body.bridge).toMatchObject({
      role: 'host',
      port: 37150,
      session_state: 'linked',
      pending_pair_code: null,
      extension_connected: true,
      last_extension_message_at: 1_756_850_000_000,
    });
    expect(body.hint).toMatch(/Bridge round-tripped/);
  });

  it('classifies a session-not-ready throw and names the pending pair code', async () => {
    const health = fakeBridgeHealth({
      session: { state: 'pair_pending', pairCode: '4711', extensionConnected: true },
    });
    const body = await runHealthcheck({
      ...fakeTransport(() => {
        throw new FetchproxySessionNotReadyError({ mcpId: 'hemnet-mcp', pairCode: '4711' });
      }),
      status: () => ({ transport: 'fetchproxy', mode: 'fetchproxy' }),
      bridgeTransport: () => fakeBridgeTransport(health),
    });
    expect(body.ok).toBe(false);
    expect(body.error?.kind).toBe('session_not_ready');
    expect(body.bridge?.session_state).toBe('pair_pending');
    expect(body.bridge?.pending_pair_code).toBe('4711');
    expect(body.hint).toMatch(/4711/);
  });

  it('still classifies session-not-ready through the real transport wrapper', async () => {
    // HemnetFetchproxyTransport re-throws bridge failures as a prefixed
    // Error; the typed fetchproxy error must survive as `cause` so the
    // healthcheck can name the missing leg instead of saying "unknown".
    const bridge = fakeBridge({
      fetch: async () => {
        throw new FetchproxySessionNotReadyError({ mcpId: 'hemnet-mcp', pairCode: null });
      },
      status: () =>
        fakeBridgeHealth({
          session: { state: 'no_session', pairCode: null, extensionConnected: true },
        }),
    });
    const body = await runHealthcheck(new HemnetFetchproxyTransport({ bridge }));
    expect(body.ok).toBe(false);
    expect(body.error?.kind).toBe('session_not_ready');
    expect(body.error?.message).toMatch(/^Hemnet bridge:/);
    expect(body.transport).toEqual({ transport: 'fetchproxy', mode: 'fetchproxy' });
    expect(body.bridge?.session_state).toBe('no_session');
    expect(body.hint).toMatch(/never confirmed a session/);
  });

  it('classifies the bridge leg\'s non-JSON challenge page as cloudflare_challenge (#56)', async () => {
    const bridge = fakeBridge({
      fetch: async () => ({ status: 200, body: '<!DOCTYPE html><title>Just a moment...</title>', url: 'u' }),
    });
    const body = await runHealthcheck(new HemnetFetchproxyTransport({ bridge }));
    expect(body.ok).toBe(false);
    expect(body.error?.kind).toBe('cloudflare_challenge');
    expect(body.error?.message).toMatch(/non-JSON via the browser bridge/);
    expect(body.hint).toMatch(/HEMNET_TRANSPORT=fetchproxy/);
  });

  it('files the bridge leg\'s non-2xx as http, not unknown (#56)', async () => {
    const bridge = fakeBridge({
      fetch: async () => ({ status: 502, body: 'bad gateway', url: 'u' }),
    });
    const body = await runHealthcheck(new HemnetFetchproxyTransport({ bridge }));
    expect(body.ok).toBe(false);
    expect(body.error?.kind).toBe('http');
    expect(body.error?.message).toMatch(/HTTP 502 via browser bridge/);
  });

  it('keeps the default classification when the wrapped cause is not a fetchproxy error', async () => {
    const body = await runHealthcheck({
      ...fakeTransport(() => {
        throw new Error('Hemnet bridge: something odd', { cause: new Error('odd') });
      }),
      status: () => ({ transport: 'fetchproxy', mode: 'fetchproxy' }),
      bridgeTransport: () => fakeBridgeTransport(fakeBridgeHealth({ role: null })),
    });
    expect(body.ok).toBe(false);
    expect(body.error?.kind).toBe('unknown');
    expect(body.hint).toMatch(/never bound a role/);
  });
});
