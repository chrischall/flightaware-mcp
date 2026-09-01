import { describe, it, expect, vi } from 'vitest';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerHealthcheckTools } from '../src/tools/health.js';
import type { FlightAwareClient } from '../src/client.js';

function setup(env: Record<string, string | undefined>, probe?: () => Promise<unknown>) {
  const get = vi.fn(probe ?? (async () => ({ code: 'KJFK' })));
  const server = new McpServer({ name: 'test', version: '0.0.0' });
  registerHealthcheckTools(server, { get } as unknown as FlightAwareClient, (k: string) => env[k]);
  const call = async () =>
    JSON.parse((await (server as any)._registeredTools.fa_healthcheck.handler({}, {})).content[0].text);
  return { server, call, get };
}

const FULL = { AEROAPI_API_KEY: 'KEY' };

describe('fa_healthcheck', () => {
  it('registers under the repo tool prefix', () => {
    expect(Object.keys((setup(FULL).server as any)._registeredTools)).toEqual(['fa_healthcheck']);
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

  it('reads the real environment when no reader is injected', async () => {
    vi.stubEnv('AEROAPI_API_KEY', 'REAL-KEY');
    const server = new McpServer({ name: 'test', version: '0.0.0' });
    registerHealthcheckTools(server, { get: vi.fn(async () => ({})) } as any);
    const out = JSON.parse(
      (await (server as any)._registeredTools.fa_healthcheck.handler({}, {})).content[0].text,
    );
    expect(out.credential.resolved).toBe(true);
    expect(JSON.stringify(out)).not.toContain('REAL-KEY');
    vi.unstubAllEnvs();
  });
});
