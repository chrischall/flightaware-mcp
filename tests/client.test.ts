import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { FlightAwareClient } from '../src/client.js';

const KEY = 'aero-test-key';

/** Read a header from whatever shape createApiClient passed (object or Headers). */
function headerOf(init: RequestInit | undefined, name: string): string | null {
  const h = init?.headers;
  if (!h) return null;
  if (h instanceof Headers) return h.get(name);
  const rec = h as Record<string, string>;
  const hit = Object.keys(rec).find((k) => k.toLowerCase() === name.toLowerCase());
  return hit ? rec[hit] : null;
}

describe('FlightAwareClient', () => {
  beforeEach(() => {
    process.env.AEROAPI_API_KEY = KEY;
  });
  afterEach(() => {
    delete process.env.AEROAPI_API_KEY;
    vi.restoreAllMocks();
  });

  it('GET sends the x-apikey header and returns parsed JSON', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ flights: [{ ident: 'UAL123' }] }), { status: 200, headers: { 'content-type': 'application/json' } }));
    const c = new FlightAwareClient({ fetchImpl: fetchImpl as unknown as typeof fetch });
    const data = await c.get<{ flights: unknown[] }>('/flights/UAL123');
    expect(data.flights).toHaveLength(1);
    const [url, init] = fetchImpl.mock.calls[0];
    expect(String(url)).toContain('/aeroapi/flights/UAL123');
    expect(headerOf(init, 'x-apikey')).toBe(KEY);
  });

  it('write() POST parses the Location header into locationId', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ ident: 'UAL123' }), {
      status: 201,
      headers: { 'content-type': 'application/json', location: '/alerts/98765' },
    }));
    const c = new FlightAwareClient({ fetchImpl: fetchImpl as unknown as typeof fetch });
    const res = await c.write('POST', '/alerts', { ident: 'UAL123' });
    expect(res.status).toBe(201);
    expect(res.locationId).toBe('98765');
    expect(res.data).toEqual({ ident: 'UAL123' });
    const [, init] = fetchImpl.mock.calls[0];
    expect(headerOf(init, 'x-apikey')).toBe(KEY);
    expect(init?.method).toBe('POST');
    expect(init?.body).toBe(JSON.stringify({ ident: 'UAL123' }));
  });

  it('write() DELETE tolerates an empty 204 body', async () => {
    const fetchImpl = vi.fn(async () => new Response(null, { status: 204 }));
    const c = new FlightAwareClient({ fetchImpl: fetchImpl as unknown as typeof fetch });
    const res = await c.write('DELETE', '/alerts/5');
    expect(res.status).toBe(204);
    expect(res.data).toBeUndefined();
  });

  it('write() throws McpToolError on a non-2xx response', async () => {
    const fetchImpl = vi.fn(async () => new Response('{"title":"bad request"}', { status: 400 }));
    const c = new FlightAwareClient({ fetchImpl: fetchImpl as unknown as typeof fetch });
    await expect(c.write('POST', '/alerts', {})).rejects.toThrow();
  });

  it('defers the config error: no key boots, but a call rejects with an actionable hint', async () => {
    delete process.env.AEROAPI_API_KEY;
    const fetchImpl = vi.fn();
    const c = new FlightAwareClient({ fetchImpl: fetchImpl as unknown as typeof fetch });
    await expect(c.get('/flights/UAL123')).rejects.toThrow(/AEROAPI_API_KEY/);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
