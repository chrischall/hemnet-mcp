import { describe, it, expect, vi } from 'vitest';
import {
  CloudflareChallengeError,
  DirectTransport,
} from '../src/transport-direct.js';

/** A minimal fetch stub returning a Response-like object. */
function jsonResponse(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers(),
    text: async () => JSON.stringify(body),
    json: async () => body,
  } as unknown as Response;
}

/** A non-2xx Response-like stub with a raw text body and headers. */
function textResponse(
  status: number,
  body: string,
  headers: Record<string, string> = {},
) {
  return {
    ok: false,
    status,
    headers: new Headers(headers),
    text: async () => body,
    json: async () => JSON.parse(body),
  } as unknown as Response;
}

describe('DirectTransport', () => {
  it('POSTs the operation and returns the envelope', async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse(200, { data: { ok: true } }),
    );
    const t = new DirectTransport({ fetchImpl, version: '1.2.3' });
    const res = await t.graphql('query X { x }', { a: 1 });
    expect(res).toEqual({ data: { ok: true } });
    expect(fetchImpl).toHaveBeenCalledOnce();
    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(url).toBe('https://www.hemnet.se/graphql');
    expect(init!.method).toBe('POST');
    expect(JSON.parse(init!.body as string)).toEqual({
      query: 'query X { x }',
      variables: { a: 1 },
    });
    expect((init!.headers as Record<string, string>)['user-agent']).toContain(
      '1.2.3',
    );
  });

  it('honours a custom endpoint', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(200, { data: {} }));
    const t = new DirectTransport({ fetchImpl, endpoint: 'http://x/gql' });
    await t.graphql('q', {});
    expect(fetchImpl.mock.calls[0]![0]).toBe('http://x/gql');
  });

  it('retries a 503 then succeeds', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(503, {}))
      .mockResolvedValueOnce(jsonResponse(200, { data: { ok: 1 } }));
    const t = new DirectTransport({ fetchImpl, maxRetries: 2 });
    const res = await t.graphql('q', {});
    expect(res).toEqual({ data: { ok: 1 } });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('does not retry a hard 4xx', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(400, {}));
    const t = new DirectTransport({ fetchImpl, maxRetries: 3 });
    await expect(t.graphql('q', {})).rejects.toThrow('HTTP 400');
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it('retries network errors and throws the last one after exhausting', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error('ECONNRESET');
    });
    const t = new DirectTransport({ fetchImpl, maxRetries: 1 });
    await expect(t.graphql('q', {})).rejects.toThrow('ECONNRESET');
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('exhausts retryable statuses and throws the status error', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(429, {}));
    const t = new DirectTransport({ fetchImpl, maxRetries: 1 });
    await expect(t.graphql('q', {})).rejects.toThrow('HTTP 429');
  });

  it('falls back to a generic error when the thrown value is not an Error', async () => {
    const fetchImpl = vi.fn(async () => {
      throw 'boom';
    });
    const t = new DirectTransport({ fetchImpl, maxRetries: 0 });
    await expect(t.graphql('q', {})).rejects.toThrow(
      'Hemnet GraphQL request failed',
    );
  });

  it('aborts a fetch that outruns the timeout', async () => {
    const fetchImpl = vi.fn(
      (_url: string | URL | Request, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () =>
            reject(new Error('aborted')),
          );
        }),
    );
    const t = new DirectTransport({
      fetchImpl: fetchImpl as unknown as typeof fetch,
      timeoutMs: 5,
      maxRetries: 0,
    });
    await expect(t.graphql('q', {})).rejects.toThrow('aborted');
  });

  it('classifies a Cloudflare challenge 403 (cf-mitigated header) as CloudflareChallengeError', async () => {
    const fetchImpl = vi.fn(async () =>
      textResponse(403, '<!DOCTYPE html><html><head><title>Just a moment...</title>', {
        'cf-mitigated': 'challenge',
        'cf-ray': 'a1a7d3f27ca34ff4-ATL',
        server: 'cloudflare',
      }),
    );
    const t = new DirectTransport({ fetchImpl, maxRetries: 3 });
    const err = await t.graphql('q', {}).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(CloudflareChallengeError);
    const msg = (err as Error).message;
    expect(msg).toContain('HTTP 403');
    expect(msg).toContain('Cloudflare');
    expect(msg).toContain('cf-ray: a1a7d3f27ca34ff4-ATL');
    expect(msg).toContain('browser');
    // Hard failure: no retries against a challenge wall.
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it('classifies a challenge by body marker with no diagnostic headers', async () => {
    const fetchImpl = vi.fn(async () =>
      textResponse(403, '<html><script>window._cf_chl_opt = {};</script></html>'),
    );
    const t = new DirectTransport({ fetchImpl });
    const err = await t.graphql('q', {}).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(CloudflareChallengeError);
    // No `(…)` diagnostic segment when no server/cf-ray/cf-mitigated present.
    expect((err as Error).message).toContain('Cloudflare bot challenge.');
  });

  it('includes response body head and diagnostic headers in a plain 4xx error', async () => {
    const body = `{"error":"nope"}${'x'.repeat(300)}`;
    const fetchImpl = vi.fn(async () =>
      textResponse(403, body, { server: 'nginx', 'cf-ray': 'abc123-CPH' }),
    );
    const t = new DirectTransport({ fetchImpl });
    const err = await t.graphql('q', {}).catch((e: unknown) => e);
    expect(err).not.toBeInstanceOf(CloudflareChallengeError);
    const msg = (err as Error).message;
    expect(msg).toContain('Hemnet GraphQL HTTP 403');
    expect(msg).toContain('server: nginx');
    expect(msg).toContain('cf-ray: abc123-CPH');
    expect(msg).toContain('{"error":"nope"}');
    // Body is capped at ~200 chars, not dumped wholesale.
    expect(msg.length).toBeLessThan(500);
  });

  it('still errors cleanly when the failure body cannot be read', async () => {
    const fetchImpl = vi.fn(async () =>
      ({
        ok: false,
        status: 400,
        headers: new Headers(),
        text: async () => {
          throw new Error('body stream lost');
        },
      }) as unknown as Response,
    );
    const t = new DirectTransport({ fetchImpl });
    await expect(t.graphql('q', {})).rejects.toThrow('Hemnet GraphQL HTTP 400');
  });

  it('constructs with all defaults', () => {
    // Exercises the `?? fetch` / `?? '0.0.0'` default branches without a call.
    expect(new DirectTransport()).toBeInstanceOf(DirectTransport);
  });
});

describe('DirectTransport.status', () => {
  it('reports the direct path', () => {
    const t = new DirectTransport();
    expect(t.status()).toEqual({ transport: 'direct', mode: 'direct' });
  });
});
