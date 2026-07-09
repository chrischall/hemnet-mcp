import { describe, it, expect, vi } from 'vitest';
import { DirectTransport } from '../src/transport-direct.js';

/** A minimal fetch stub returning a Response-like object. */
function jsonResponse(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
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

  it('constructs with all defaults', () => {
    // Exercises the `?? fetch` / `?? '0.0.0'` default branches without a call.
    expect(new DirectTransport()).toBeInstanceOf(DirectTransport);
  });
});
