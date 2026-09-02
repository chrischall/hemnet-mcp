import { describe, it, expect, vi, afterEach } from 'vitest';
import { CloudflareChallengeError, DirectTransport } from '../src/transport-direct.js';
import { HemnetFetchproxyTransport } from '../src/transport-fetchproxy.js';
import {
  FallbackTransport,
  createDefaultTransport,
} from '../src/transport-fallback.js';
import type { HemnetTransport } from '../src/transport.js';
import { fakeBridgeTransport } from './helpers.js';

function transportReturning(data: unknown): HemnetTransport {
  return { graphql: vi.fn(async () => ({ data })) } as HemnetTransport;
}

function transportThrowing(err: Error): HemnetTransport {
  return { graphql: vi.fn(async () => Promise.reject(err)) } as HemnetTransport;
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('FallbackTransport', () => {
  it('serves from the direct transport and never builds the bridge', async () => {
    const direct = transportReturning({ ok: 1 });
    const factory = vi.fn();
    const t = new FallbackTransport(direct, factory);
    expect(await t.graphql('q', {})).toEqual({ data: { ok: 1 } });
    expect(factory).not.toHaveBeenCalled();
  });

  it('switches to the bridge on a Cloudflare challenge and stays there', async () => {
    const stderr = vi.spyOn(console, 'error').mockImplementation(() => {});
    const direct = transportThrowing(new CloudflareChallengeError('walled'));
    const bridge = transportReturning({ via: 'bridge' });
    const factory = vi.fn(() => bridge);
    const t = new FallbackTransport(direct, factory);

    expect(await t.graphql('q', {})).toEqual({ data: { via: 'bridge' } });
    expect(await t.graphql('q', {})).toEqual({ data: { via: 'bridge' } });
    // Direct tried exactly once; the wall verdict is sticky for the process.
    expect(direct.graphql).toHaveBeenCalledOnce();
    expect(factory).toHaveBeenCalledOnce();
    expect(bridge.graphql).toHaveBeenCalledTimes(2);
    // The switch is announced on stderr (stdout is JSON-RPC).
    expect(stderr).toHaveBeenCalledWith(
      expect.stringContaining('Cloudflare'),
    );
  });

  it('propagates non-challenge errors without touching the bridge', async () => {
    const direct = transportThrowing(new Error('HTTP 400'));
    const factory = vi.fn();
    const t = new FallbackTransport(direct, factory);
    await expect(t.graphql('q', {})).rejects.toThrow('HTTP 400');
    expect(factory).not.toHaveBeenCalled();
  });
});

describe('createDefaultTransport', () => {
  it('builds the direct transport when HEMNET_TRANSPORT=direct', () => {
    vi.stubEnv('HEMNET_TRANSPORT', 'direct');
    expect(createDefaultTransport()).toBeInstanceOf(DirectTransport);
  });

  it('forwards wire options (endpoint/fetchImpl) to the default direct transport', async () => {
    vi.stubEnv('HEMNET_TRANSPORT', 'direct');
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      status: 200,
      headers: new Headers(),
      text: async () => '{"data":{}}',
      json: async () => ({ data: {} }),
    })) as unknown as typeof fetch;
    const t = createDefaultTransport({ endpoint: 'http://x/gql', fetchImpl });
    await t.graphql('q', {});
    expect(vi.mocked(fetchImpl).mock.calls[0]![0]).toBe('http://x/gql');
  });

  it('builds the bridge transport when HEMNET_TRANSPORT=fetchproxy', () => {
    vi.stubEnv('HEMNET_TRANSPORT', 'fetchproxy');
    expect(createDefaultTransport()).toBeInstanceOf(HemnetFetchproxyTransport);
  });

  it('defaults to direct-with-bridge-fallback', () => {
    expect(createDefaultTransport()).toBeInstanceOf(FallbackTransport);
  });

  it('warns and falls back to auto on an unknown mode', () => {
    const stderr = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.stubEnv('HEMNET_TRANSPORT', 'quantum');
    expect(createDefaultTransport()).toBeInstanceOf(FallbackTransport);
    expect(stderr).toHaveBeenCalledWith(expect.stringContaining('quantum'));
  });

  it('wires the injected seams through auto mode', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const walled = transportThrowing(new CloudflareChallengeError('walled'));
    const bridge = transportReturning({ via: 'bridge' });
    const t = createDefaultTransport({
      direct: walled,
      bridgeFactory: () => bridge,
    });
    expect(t).toBeInstanceOf(FallbackTransport);
    expect(await t.graphql('q', {})).toEqual({ data: { via: 'bridge' } });
  });
});

describe('FallbackTransport.status', () => {
  it('reports the direct path in auto mode before any challenge', () => {
    const direct = { ...transportReturning({ ok: 1 }), status: () => ({ transport: 'direct' as const, mode: 'direct' as const }) };
    const t = new FallbackTransport(direct, vi.fn());
    expect(t.status()).toEqual({ transport: 'direct', mode: 'auto' });
  });

  it('reports the bridge path (with its bridge block) once switched', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const direct = transportThrowing(new CloudflareChallengeError('walled'));
    const bridge = {
      ...transportReturning({ via: 'bridge' }),
      status: () => ({
        transport: 'fetchproxy' as const,
        mode: 'fetchproxy' as const,
      }),
    };
    const t = new FallbackTransport(direct, () => bridge);
    await t.graphql('q', {});
    expect(t.status()).toEqual({ transport: 'fetchproxy', mode: 'auto' });
  });

  it('reports unknown paths when a transport has no status()', () => {
    const t = new FallbackTransport(transportReturning({ ok: 1 }), vi.fn());
    expect(t.status()).toEqual({ transport: 'unknown', mode: 'auto' });
  });
});

describe('FallbackTransport.bridgeTransport', () => {
  it('is undefined until a challenge builds the bridge, then the bridge\'s own', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const direct = transportThrowing(new CloudflareChallengeError('walled'));
    const bridgeTransport = fakeBridgeTransport();
    const bridge = {
      ...transportReturning({ via: 'bridge' }),
      bridgeTransport: () => bridgeTransport,
    };
    const t = new FallbackTransport(direct, () => bridge);
    expect(t.bridgeTransport()).toBeUndefined();
    await t.graphql('q', {});
    expect(t.bridgeTransport()).toBe(bridgeTransport);
  });

  it('is undefined when the built bridge does not expose one', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const direct = transportThrowing(new CloudflareChallengeError('walled'));
    const t = new FallbackTransport(direct, () => transportReturning({ via: 'bridge' }));
    await t.graphql('q', {});
    expect(t.bridgeTransport()).toBeUndefined();
  });
});
