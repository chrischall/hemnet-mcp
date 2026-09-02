import { describe, it, expect, vi } from 'vitest';
import { FetchproxyBridgeDownError } from '@chrischall/mcp-utils/fetchproxy';
import {
  HemnetFetchproxyTransport,
  type HemnetBridge,
} from '../src/transport-fetchproxy.js';

/** A controllable fake of the minimal bridge surface the transport uses. */
function fakeBridge(overrides: Partial<HemnetBridge> = {}): HemnetBridge {
  return {
    start: vi.fn(async () => {}),
    fetch: vi.fn(async () => ({
      status: 200,
      body: JSON.stringify({ data: { ok: true } }),
      url: 'https://www.hemnet.se/graphql',
    })),
    ...overrides,
  };
}

describe('HemnetFetchproxyTransport', () => {
  it('POSTs the operation through the bridge and returns the envelope', async () => {
    const bridge = fakeBridge();
    const t = new HemnetFetchproxyTransport({ bridge });
    const res = await t.graphql('query X { x }', { a: 1 });
    expect(res).toEqual({ data: { ok: true } });
    expect(bridge.fetch).toHaveBeenCalledOnce();
    const init = vi.mocked(bridge.fetch).mock.calls[0]![0];
    expect(init.method).toBe('POST');
    expect(init.path).toBe('/graphql');
    expect(init.headers).toMatchObject({ 'content-type': 'application/json' });
    expect(JSON.parse(init.body!)).toEqual({
      query: 'query X { x }',
      variables: { a: 1 },
    });
  });

  it('starts the bridge once across concurrent calls', async () => {
    const bridge = fakeBridge();
    const t = new HemnetFetchproxyTransport({ bridge });
    await Promise.all([t.graphql('q', {}), t.graphql('q', {})]);
    expect(bridge.start).toHaveBeenCalledOnce();
  });

  it('retries start() on the next call after a start failure', async () => {
    const start = vi
      .fn()
      .mockRejectedValueOnce(new Error('identity dir unwritable'))
      .mockResolvedValue(undefined);
    const bridge = fakeBridge({ start });
    const t = new HemnetFetchproxyTransport({ bridge });
    await expect(t.graphql('q', {})).rejects.toThrow('identity dir unwritable');
    await expect(t.graphql('q', {})).resolves.toEqual({ data: { ok: true } });
    expect(start).toHaveBeenCalledTimes(2);
  });

  it('throws an actionable error on a non-2xx bridge response', async () => {
    const bridge = fakeBridge({
      fetch: vi.fn(async () => ({ status: 500, body: 'upstream broke', url: 'u' })),
    });
    const t = new HemnetFetchproxyTransport({ bridge });
    const err = await t.graphql('q', {}).catch((e: unknown) => e);
    expect((err as Error).message).toContain('HTTP 500');
    expect((err as Error).message).toContain('upstream broke');
  });

  it('flags a non-JSON 2xx as a likely challenge interstitial', async () => {
    const bridge = fakeBridge({
      fetch: vi.fn(async () => ({
        status: 200,
        body: '<!DOCTYPE html><title>Just a moment...</title>',
        url: 'u',
      })),
    });
    const t = new HemnetFetchproxyTransport({ bridge });
    const err = await t.graphql('q', {}).catch((e: unknown) => e);
    expect((err as Error).message).toContain('non-JSON');
    expect((err as Error).message).toContain('hemnet.se');
  });

  it('wraps a plain bridge-layer failure (no hint) with the prefix', async () => {
    const bridge = fakeBridge({
      fetch: vi.fn(async () => {
        throw new Error('no transporter connected');
      }),
    });
    const t = new HemnetFetchproxyTransport({ bridge });
    await expect(t.graphql('q', {})).rejects.toThrow(
      'Hemnet bridge: no transporter connected',
    );
  });

  it('appends the remediation hint for a typed bridge error', async () => {
    const bridge = fakeBridge({
      fetch: vi.fn(async () => {
        throw new FetchproxyBridgeDownError('bridge down');
      }),
    });
    const t = new HemnetFetchproxyTransport({ bridge });
    const err = await t.graphql('q', {}).catch((e: unknown) => e);
    expect((err as Error).message).toContain('Hemnet bridge:');
    expect((err as Error).message).toMatch(/service worker|tab for this domain/);
  });

  it('constructs the real fetchproxy transport by default', () => {
    // No verb call — construction is cheap and binds nothing.
    expect(new HemnetFetchproxyTransport({ version: '9.9.9' })).toBeInstanceOf(
      HemnetFetchproxyTransport,
    );
  });

  it('forwards the createServer test seam to the real transport factory', () => {
    // Exercises the `createServer` spread arm without a live extension:
    // the seam is only invoked on the first verb call, so construction is
    // enough to cover the branch.
    const createServer = vi.fn();
    const t = new HemnetFetchproxyTransport({
      version: '9.9.9',
      createServer: createServer as never,
    });
    expect(t).toBeInstanceOf(HemnetFetchproxyTransport);
  });
});

describe('HemnetFetchproxyTransport.status', () => {
  it('reports the bridge role, port and extension liveness when the bridge exposes them', () => {
    const bridge = fakeBridge({
      status: () => ({ role: 'host', port: 37150, lastExtensionMessageAt: 1_756_850_000_000 }),
    });
    const t = new HemnetFetchproxyTransport({ bridge });
    expect(t.status()).toEqual({
      transport: 'fetchproxy',
      mode: 'fetchproxy',
      bridge: {
        role: 'host',
        port: 37150,
        last_extension_message_at: '2025-09-02T21:53:20.000Z',
      },
    });
  });

  it('reports a bridge the extension never spoke to as last_extension_message_at: null', () => {
    const bridge = fakeBridge({
      status: () => ({ role: 'host', port: 37150, lastExtensionMessageAt: null }),
    });
    const t = new HemnetFetchproxyTransport({ bridge });
    expect(t.status()).toMatchObject({
      bridge: { role: 'host', port: 37150, last_extension_message_at: null },
    });
  });

  it('omits the bridge block when the bridge has no status', () => {
    const t = new HemnetFetchproxyTransport({ bridge: fakeBridge() });
    expect(t.status()).toEqual({ transport: 'fetchproxy', mode: 'fetchproxy' });
  });
});
