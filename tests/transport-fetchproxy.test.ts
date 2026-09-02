import { describe, it, expect, vi } from 'vitest';
import { FetchproxyBridgeDownError } from '@chrischall/mcp-utils/fetchproxy';
import { HemnetFetchproxyTransport } from '../src/transport-fetchproxy.js';
import { CloudflareChallengeError } from '../src/transport-direct.js';
import { fakeBridge, fakeBridgeHealth } from './helpers.js';

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
    // Typed for the healthcheck's classifier.
    expect((err as Error).cause).toBeInstanceOf(CloudflareChallengeError);
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

  it('appends the remediation hint for a typed bridge error and keeps it as cause', async () => {
    const original = new FetchproxyBridgeDownError('bridge down');
    const bridge = fakeBridge({
      fetch: vi.fn(async () => {
        throw original;
      }),
    });
    const t = new HemnetFetchproxyTransport({ bridge });
    const err = await t.graphql('q', {}).catch((e: unknown) => e);
    expect((err as Error).message).toContain('Hemnet bridge:');
    expect((err as Error).message).toMatch(/service worker|tab for this domain/);
    // The typed error survives as `cause` so a healthcheck can classify it.
    expect((err as Error).cause).toBe(original);
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

describe('HemnetFetchproxyTransport.status / bridgeTransport', () => {
  it('reports the fetchproxy path; the bridge state itself comes from bridgeTransport()', () => {
    const t = new HemnetFetchproxyTransport({ bridge: fakeBridge() });
    expect(t.status()).toEqual({ transport: 'fetchproxy', mode: 'fetchproxy' });
  });

  it('exposes the underlying bridge for the shared healthcheck', () => {
    const health = fakeBridgeHealth({ role: 'peer' });
    const bridge = fakeBridge({ status: () => health });
    const t = new HemnetFetchproxyTransport({ bridge });
    expect(t.bridgeTransport()).toBe(bridge);
    expect(t.bridgeTransport().status()).toBe(health);
  });
});
