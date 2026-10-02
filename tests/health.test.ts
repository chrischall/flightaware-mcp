import { describe, it, expect, vi } from 'vitest';
import { createTestHarness, parseToolResult } from '@chrischall/mcp-utils/test';
import { registerHealthcheckTools } from '../src/tools/health.js';
import { FlightAwareClient } from '../src/client.js';

function setup(env: Record<string, string | undefined>, probe?: () => Promise<unknown>) {
  const get = vi.fn(probe ?? (async () => ({ code: 'KJFK' })));
  const harness = createTestHarness((s) =>
    registerHealthcheckTools(s, { get } as unknown as FlightAwareClient, (k: string) => env[k]),
  );
  const call = async () => parseToolResult<any>(await (await harness).callTool('fa_healthcheck'));
  const names = async () => (await (await harness).listTools()).map((t) => t.name);
  return { call, get, names };
}

const FULL = { AEROAPI_API_KEY: 'KEY' };

describe('fa_healthcheck', () => {
  it('registers under the repo tool prefix', async () => {
    expect(await setup(FULL).names()).toEqual(['fa_healthcheck']);
  });

  it('reports ok when the key resolves and the probe succeeds', async () => {
    const out = await setup(FULL).call();
    expect(out.ok).toBe(true);
  });

  // AeroAPI bills per query. A static-cached lookup is the cheapest request
  // class and is served from cache on repeat checks.
  it('probes a static-cached airport read, not a billed live query', async () => {
    const { call, get } = setup(FULL);
    await call();
    expect(get).toHaveBeenCalledWith('/airports/KJFK', { cache: 'static' });
  });

  // /airports/{id}/canonical 401s on the free Personal tier with a valid key.
  it('does not probe a tier-restricted endpoint', async () => {
    const { call, get } = setup(FULL);
    await call();
    expect(get.mock.calls[0][0]).not.toContain('canonical');
  });

  it('reports a missing key as no_credential and skips the probe', async () => {
    const { call, get } = setup({});
    const out = await call();
    expect(out.error.kind).toBe('no_credential');
    expect(get).not.toHaveBeenCalled();
  });

  it('never echoes the key', async () => {
    const out = await setup({ AEROAPI_API_KEY: 'SUPER-SECRET' }).call();
    expect(JSON.stringify(out)).not.toContain('SUPER-SECRET');
  });

  it('separates rate limiting from a rejected key', async () => {
    const out = await setup(FULL, async () => { throw new Error('Rate limited by AeroAPI'); }).call();
    expect(out.error.kind).toBe('rate_limited');
    expect(out.error.kind).not.toBe('credential_rejected');
  });

  it('mentions the tier trap when the key is rejected', async () => {
    const out = await setup(FULL, async () => { throw new Error('HTTP 401 Unauthorized'); }).call();
    expect(out.error.kind).toBe('credential_rejected');
    expect(out.hint).toMatch(/tier/i);
  });

  it('leaves an unrecognised failure to the helper defaults', async () => {
    const out = await setup(FULL, async () => { throw new Error('socket hang up'); }).call();
    expect(out.ok).toBe(false);
    expect(out.error.kind).not.toBe('rate_limited');
  });

  it('classifies a non-Error throw without crashing', async () => {
    const out = await setup(FULL, async () => { throw 'Rate limited by AeroAPI'; }).call();
    expect(out.error.kind).toBe('rate_limited');
  });

  // The regression the auto-review caught: index.ts registers tool modules as
  // (server) => void and passes no client, so a REQUIRED client parameter is
  // undefined in production while injected-mock tests still pass.
  it('registers and runs with no client argument, as index.ts calls it', async () => {
    const h = await createTestHarness((s) =>
      (registerHealthcheckTools as unknown as (srv: typeof s) => void)(s),
    );
    const out = parseToolResult<any>(await h.callTool('fa_healthcheck'));
    // Without AEROAPI_API_KEY the probe is skipped, so this exercises exactly
    // the wiring — no network, and crucially no "client is undefined" throw.
    expect(out).toHaveProperty('ok');
    expect(out).toHaveProperty('credential');
    // Structural guard: only `server` may be REQUIRED. A required client
    // parameter makes arity 2, which is precisely the production bug — and
    // the assertion above cannot catch it on its own, because with no API key
    // the probe is skipped and the undefined client is never dereferenced.
    expect(registerHealthcheckTools.length).toBe(1);
  });

  it('reads the real environment when no reader is injected', async () => {
    vi.stubEnv('AEROAPI_API_KEY', 'REAL-KEY');
    const h = await createTestHarness((s) =>
      registerHealthcheckTools(s, { get: vi.fn(async () => ({})) } as any),
    );
    const out = parseToolResult<any>(await h.callTool('fa_healthcheck'));
    expect(out.credential.resolved).toBe(true);
    expect(JSON.stringify(out)).not.toContain('REAL-KEY');
    vi.unstubAllEnvs();
  });
});

// chrischall/mcp-host#1015: a CDN/WAF refusal page answers 403 before AeroAPI
// sees the key. mcp-utils 2.9.0's client throws EdgeBlockedError for it, whose
// message says "(HTTP 403)" — which classifyFlightAwareError's 401/403 regex
// used to relabel credential_rejected ("AeroAPI rejected the key").
describe('fa_healthcheck — a CDN/WAF block is not a rejected key', () => {
  const CLOUDFRONT_BLOCK =
    '<!DOCTYPE HTML PUBLIC "-//W3C//DTD HTML 4.01 Transitional//EN" "http://www.w3.org/TR/html4/loose.dtd">' +
    '<HTML><HEAD><META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=iso-8859-1">' +
    '<TITLE>ERROR: The request could not be satisfied</TITLE></HEAD><BODY>' +
    '<H1>403 ERROR</H1><H2>The request could not be satisfied.</H2><HR noshade size="1px">' +
    "Request blocked. We can't connect to the server for this app or website at this time." +
    '<BR clear="all"><HR noshade size="1px"><PRE>Generated by cloudfront (CloudFront)\n' +
    'Request ID: AbCdEfGhIjKlMnOpQrStUvWxYz0123456789==</PRE><ADDRESS></ADDRESS></BODY></HTML>';

  async function healthcheckThrough(res: () => Response) {
    vi.stubEnv('AEROAPI_API_KEY', 'KEY');
    const client = new FlightAwareClient({ fetchImpl: vi.fn(async () => res()) as unknown as typeof fetch });
    const h = await createTestHarness((s) => registerHealthcheckTools(s, client, () => 'KEY'));
    const out = parseToolResult<any>(await h.callTool('fa_healthcheck'));
    vi.unstubAllEnvs();
    return out;
  }

  it('reports a CloudFront 403 block page as edge_blocked through the real client', async () => {
    const out = await healthcheckThrough(
      () =>
        new Response(CLOUDFRONT_BLOCK, {
          status: 403,
          headers: { 'content-type': 'text/html', 'x-cache': 'Error from cloudfront' },
        }),
    );
    expect(out.ok).toBe(false);
    expect(out.error.kind).toBe('edge_blocked');
    expect(out.hint).not.toMatch(/rejected the key/);
  });

  it('control: a JSON 403 from AeroAPI itself is still credential_rejected', async () => {
    const out = await healthcheckThrough(
      () =>
        new Response(JSON.stringify({ title: 'Forbidden', status: 403 }), {
          status: 403,
          headers: { 'content-type': 'application/json' },
        }),
    );
    expect(out.error.kind).toBe('credential_rejected');
  });
});
