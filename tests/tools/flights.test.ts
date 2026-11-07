import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { createTestHarness, parseToolResult } from '@chrischall/mcp-utils/test';
import { registerFlightTools } from '../../src/tools/flights.js';
import { client } from '../../src/client.js';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

afterEach(() => vi.restoreAllMocks());

describe('fa_get_flight_map file output', () => {
  const png = Buffer.from('fake-png').toString('base64');
  const ID = 'UAL123-1700000000-airline-0123';

  async function saveMap(args: Record<string, unknown>): Promise<string> {
    vi.spyOn(client, 'get').mockResolvedValue({ map: png });
    const h = await createTestHarness(registerFlightTools);
    try {
      return parseToolResult<{ map: string }>(await h.callTool('fa_get_flight_map', { id: ID, ...args })).map;
    } finally {
      await h.close();
    }
  }

  it('writes into output_dir under a never-overwriting name', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'fa-'));
    vi.stubEnv('AEROAPI_OUTPUT_DIR', dir);
    try {
      const p1 = await saveMap({ output_dir: dir });
      const p2 = await saveMap({ output_dir: dir });
      expect(p1).toBe(join(dir, `flight-map-${ID}.png`));
      expect(p2).toBe(join(dir, `flight-map-${ID}-2.png`));
      expect(readFileSync(p1).toString()).toBe('fake-png');
      expect(readFileSync(p2).toString()).toBe('fake-png');
    } finally {
      vi.unstubAllEnvs();
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('creates a nested output_dir that does not exist yet', async () => {
    const base = mkdtempSync(join(tmpdir(), 'fa-'));
    const dir = join(base, 'nested', 'out');
    vi.stubEnv('AEROAPI_OUTPUT_DIR', base);
    try {
      expect(dirname(await saveMap({ output_dir: dir }))).toBe(dir);
    } finally {
      vi.unstubAllEnvs();
      rmSync(base, { recursive: true, force: true });
    }
  });

  it('never writes through a symlink planted at the destination name', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'fa-'));
    const outside = join(mkdtempSync(join(tmpdir(), 'fa-out-')), 'target.png');
    vi.stubEnv('AEROAPI_OUTPUT_DIR', dir);
    try {
      symlinkSync(outside, join(dir, `flight-map-${ID}.png`)); // dangling: looks "free" to existsSync
      const p = await saveMap({ output_dir: dir });
      expect(p).toBe(join(dir, `flight-map-${ID}-2.png`));
      expect(existsSync(outside)).toBe(false);
    } finally {
      vi.unstubAllEnvs();
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('confines a per-call output_dir to $AEROAPI_OUTPUT_DIR once the operator sets it', async () => {
    const root = mkdtempSync(join(tmpdir(), 'fa-root-'));
    const elsewhere = mkdtempSync(join(tmpdir(), 'fa-else-'));
    vi.stubEnv('AEROAPI_OUTPUT_DIR', root);
    try {
      expect(dirname(await saveMap({ output_dir: join(root, 'maps') }))).toBe(join(root, 'maps'));
      vi.spyOn(client, 'get').mockResolvedValue({ map: png });
      const h = await createTestHarness(registerFlightTools);
      const res = await h.callTool('fa_get_flight_map', { id: ID, output_dir: elsewhere });
      await h.close();
      expect(res.isError).toBe(true);
      expect(readdirSync(elsewhere)).toEqual([]);
    } finally {
      vi.unstubAllEnvs();
      rmSync(root, { recursive: true, force: true });
      rmSync(elsewhere, { recursive: true, force: true });
    }
  });

  it('confines a per-call output_dir to ~/Downloads/flightaware-mcp when AEROAPI_OUTPUT_DIR is unset', async () => {
    const home = mkdtempSync(join(tmpdir(), 'fa-home-'));
    const elsewhere = mkdtempSync(join(tmpdir(), 'fa-else-'));
    vi.stubEnv('AEROAPI_OUTPUT_DIR', '');
    vi.stubEnv('HOME', home);
    try {
      const inside = join(home, 'Downloads', 'flightaware-mcp', 'maps');
      expect(dirname(await saveMap({ output_dir: inside }))).toBe(inside);
      vi.spyOn(client, 'get').mockResolvedValue({ map: png });
      const h = await createTestHarness(registerFlightTools);
      const res = await h.callTool('fa_get_flight_map', { id: ID, output_dir: join(elsewhere, 'sub') });
      await h.close();
      expect(res.isError).toBe(true);
      expect(readdirSync(elsewhere)).toEqual([]);
    } finally {
      vi.unstubAllEnvs();
      rmSync(home, { recursive: true, force: true });
      rmSync(elsewhere, { recursive: true, force: true });
    }
  });

  it('falls back to $AEROAPI_OUTPUT_DIR when no output_dir is given', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'fa-'));
    vi.stubEnv('AEROAPI_OUTPUT_DIR', dir);
    try {
      await saveMap({});
      expect(readdirSync(dir)).toEqual([`flight-map-${ID}.png`]);
    } finally {
      vi.unstubAllEnvs();
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('defaults to ~/Downloads/flightaware-mcp, not cwd (desktop hosts spawn with cwd "/")', async () => {
    const home = mkdtempSync(join(tmpdir(), 'fa-home-'));
    vi.stubEnv('AEROAPI_OUTPUT_DIR', '');
    vi.stubEnv('HOME', home);
    const cwd = vi.spyOn(process, 'cwd').mockReturnValue('/');
    try {
      const p = await saveMap({});
      expect(dirname(p)).toBe(join(home, 'Downloads', 'flightaware-mcp'));
      expect(existsSync(p)).toBe(true);
    } finally {
      cwd.mockRestore();
      vi.unstubAllEnvs();
      rmSync(home, { recursive: true, force: true });
    }
  });
});

describe('fa_get_flight_map delivery (hosted / caps)', () => {
  const ID = 'UAL123-1700000000-airline-0123';
  const CAP = 10 * 1024 * 1024;
  const small = Buffer.from('fake-png').toString('base64');
  const big = Buffer.alloc(CAP + 1, 7).toString('base64');
  const BLOB_BASE = 'https://host.example/b/reg_0123456789abcdef01234567';
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'fa-deliver-'));
    vi.stubEnv('HOME', root);
    vi.stubEnv('AEROAPI_OUTPUT_DIR', join(root, 'out'));
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    rmSync(root, { recursive: true, force: true });
  });

  /** Hosted with a blob store: point it at a fake gateway and record the PUTs. */
  function stubBlobStore(): { url: string; bytes: number; type: string }[] {
    vi.stubEnv('MCP_BLOB_BASE_URL', BLOB_BASE);
    vi.stubEnv('MCP_BLOB_SIGNING_KEY', 'k'.repeat(32));
    const puts: { url: string; bytes: number; type: string }[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
        puts.push({
          url: String(url),
          bytes: (init?.body as Uint8Array).byteLength,
          type: new Headers(init?.headers).get('content-type') ?? '',
        });
        return new Response(null, { status: 201 });
      }),
    );
    return puts;
  }

  async function callMap(map: string, args: Record<string, unknown> = {}) {
    vi.spyOn(client, 'get').mockResolvedValue({ map });
    const h = await createTestHarness(registerFlightTools);
    try {
      return await h.callTool('fa_get_flight_map', { id: ID, ...args });
    } finally {
      await h.close();
    }
  }

  type Block = { type: string; text?: string; data?: string; mimeType?: string };
  const blocks = (res: { content: unknown }) => res.content as Block[];
  const nothingOnDisk = () => expect(existsSync(join(root, 'out'))).toBe(false);
  const noInlineOverCap = (res: { content: unknown }) => {
    for (const b of blocks(res)) {
      if (b.data !== undefined) expect(Buffer.from(b.data, 'base64').length).toBeLessThanOrEqual(CAP);
    }
  };

  it('local: inline:true over the inline cap saves to disk instead, and says why', async () => {
    const res = await callMap(big, { inline: true });
    expect(res.isError).toBeFalsy();
    noInlineOverCap(res);
    const data = parseToolResult<{ map: string; note?: string }>(res);
    expect(dirname(data.map)).toBe(join(root, 'out'));
    expect(readFileSync(data.map).length).toBe(CAP + 1);
    expect(data.note).toMatch(/too large to return inline/);
  });

  it('hosted: by default returns the map as an inline image and writes nothing to disk', async () => {
    const puts = stubBlobStore();
    const res = await callMap(small);
    expect(res.isError).toBeFalsy();
    expect(blocks(res)[0]).toMatchObject({ type: 'image', mimeType: 'image/png', data: small });
    expect(puts).toEqual([]);
    nothingOnDisk();
  });

  it('hosted: over the inline cap returns a signed download link, never a disk path', async () => {
    const puts = stubBlobStore();
    const res = await callMap(big);
    expect(res.isError).toBeFalsy();
    noInlineOverCap(res);
    expect(puts).toHaveLength(1);
    expect(puts[0]).toMatchObject({ bytes: CAP + 1, type: 'image/png' });
    expect(puts[0].url).toContain(`/maps/`);
    const data = parseToolResult<{ via: string; url: string; expiresAt: string; map?: string }>(res);
    expect(data.via).toBe('link');
    expect(data.url).toMatch(/^https:\/\/host\.example\//);
    expect(Date.parse(data.expiresAt)).toBeGreaterThan(Date.now());
    expect(data.map).toBeUndefined();
    nothingOnDisk();
  });

  it('hosted: output_dir / inline:false still never write the runner disk — a link instead, with a note', async () => {
    for (const args of [{ output_dir: join(root, 'out', 'maps') }, { inline: false }]) {
      const puts = stubBlobStore();
      const res = await callMap(small, args);
      expect(res.isError).toBeFalsy();
      expect(puts).toHaveLength(1);
      const data = parseToolResult<{ via: string; url: string; note: string }>(res);
      expect(data.via).toBe('link');
      expect(data.note).toMatch(/hosted/);
      nothingOnDisk();
      vi.unstubAllGlobals();
    }
  });

  it('hosted with no blob store: a small map still comes back inline', async () => {
    vi.stubEnv('MCP_DATA_DIR', join(root, 'data'));
    const res = await callMap(small);
    expect(blocks(res)[0]).toMatchObject({ type: 'image', data: small });
    nothingOnDisk();
  });

  it('hosted: inline:true over the cap still gets a link rather than an oversized image', async () => {
    const puts = stubBlobStore();
    const res = await callMap(big, { inline: true });
    noInlineOverCap(res);
    expect(puts).toHaveLength(1);
    expect(parseToolResult<{ via: string }>(res).via).toBe('link');
    nothingOnDisk();
  });

  it('hosted with no blob store: inline:false returns the image inline with a note, not a disk path', async () => {
    vi.stubEnv('MCP_DATA_DIR', join(root, 'data'));
    const res = await callMap(small, { inline: false });
    expect(blocks(res)[0]).toMatchObject({ type: 'image', data: small });
    expect(blocks(res)[1]).toMatchObject({ type: 'text' });
    expect(blocks(res)[1].text).toMatch(/inline instead/);
    nothingOnDisk();
  });

  it('hosted with no blob store: an over-cap map is refused as too large, not written to disk', async () => {
    vi.stubEnv('MCP_DATA_DIR', join(root, 'data'));
    const res = await callMap(big, { output_dir: join(root, 'out') });
    expect(res.isError).toBe(true);
    noInlineOverCap(res);
    expect(blocks(res).map((b) => b.text ?? '').join('\n')).toMatch(/inline limit/);
    nothingOnDisk();
  });
});

describe('flight tools', () => {
  it('fa_get_flights calls /flights/{ident} with query params', async () => {
    const get = vi.spyOn(client, 'get').mockResolvedValue({ flights: [] });
    const h = await createTestHarness(registerFlightTools);
    await h.callTool('fa_get_flights', { ident: 'UAL123', ident_type: 'designator', max_pages: 2 });
    expect(get).toHaveBeenCalledTimes(1);
    const path = get.mock.calls[0][0];
    expect(path).toContain('/flights/UAL123');
    expect(path).toContain('ident_type=designator');
    expect(path).toContain('max_pages=2');
    await h.close();
  });

  it('fa_search_flights hits /flights/search with the query', async () => {
    const get = vi.spyOn(client, 'get').mockResolvedValue({ flights: [] });
    const h = await createTestHarness(registerFlightTools);
    await h.callTool('fa_search_flights', { query: '-airline UAL' });
    expect(get.mock.calls[0][0]).toContain('/flights/search?');
    expect(get.mock.calls[0][0]).toContain('query=');
    await h.close();
  });

  it('fa_get_flight_map writes a PNG to disk by default and returns the path', async () => {
    const png = Buffer.from('fake-png').toString('base64');
    vi.spyOn(client, 'get').mockResolvedValue({ map: png });
    const dir = mkdtempSync(join(tmpdir(), 'fa-'));
    vi.stubEnv('AEROAPI_OUTPUT_DIR', dir);
    const h = await createTestHarness(registerFlightTools);
    try {
      const res = await h.callTool('fa_get_flight_map', { id: 'UAL123-1700000000-airline-0123', output_dir: dir });
      const data = parseToolResult<{ map: string }>(res);
      expect(data.map).toBe(join(dir, 'flight-map-UAL123-1700000000-airline-0123.png'));
    } finally {
      await h.close();
      vi.unstubAllEnvs();
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('fa_get_flight_map is not annotated read-only, since it writes files to disk', async () => {
    const h = await createTestHarness(registerFlightTools);
    const { tools } = await h.client.listTools();
    const tool = tools.find((t) => t.name === 'fa_get_flight_map');
    expect(tool?.annotations).toMatchObject({
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true,
    });
    await h.close();
  });

  it('fa_get_flight_map returns inline base64 when inline:true', async () => {
    const png = Buffer.from('fake-png').toString('base64');
    vi.spyOn(client, 'get').mockResolvedValue({ map: png });
    const h = await createTestHarness(registerFlightTools);
    const res = await h.callTool('fa_get_flight_map', { id: 'ABC123', inline: true });
    expect(res.content[0]).toMatchObject({ type: 'image', mimeType: 'image/png', data: png });
    await h.close();
  });

  it('fa_get_flight_map errors when no map is returned', async () => {
    vi.spyOn(client, 'get').mockResolvedValue({});
    const h = await createTestHarness(registerFlightTools);
    const res = await h.callTool('fa_get_flight_map', { id: 'ABC123' });
    expect(res.isError).toBe(true);
    await h.close();
  });

  it('fa_search_flight_positions hits /flights/search/positions', async () => {
    const get = vi.spyOn(client, 'get').mockResolvedValue({ positions: [] });
    const h = await createTestHarness(registerFlightTools);
    await h.callTool('fa_search_flight_positions', { query: '{match ident UAL*}' });
    expect(get.mock.calls[0][0]).toContain('/flights/search/positions?');
    await h.close();
  });

  it('fa_count_flights hits /flights/search/count', async () => {
    const get = vi.spyOn(client, 'get').mockResolvedValue({ count: 42 });
    const h = await createTestHarness(registerFlightTools);
    await h.callTool('fa_count_flights', { query: '-airline UAL' });
    expect(get.mock.calls[0][0]).toContain('/flights/search/count?');
    await h.close();
  });

  it('fa_resolve_flight hits /flights/{ident}/canonical', async () => {
    const get = vi.spyOn(client, 'get').mockResolvedValue({ idents: [] });
    const h = await createTestHarness(registerFlightTools);
    await h.callTool('fa_resolve_flight', { ident: 'UAL123', ident_type: 'designator' });
    const path = get.mock.calls[0][0];
    expect(path).toContain('/flights/UAL123/canonical');
    expect(path).toContain('ident_type=designator');
    await h.close();
  });

  it.each([
    ['fa_search_flights_advanced', { query: '{match ident UAL*}' }, '/flights/search/advanced?'],
    ['fa_get_flight_track', { id: 'UAL1-1-airline-0' }, '/flights/UAL1-1-airline-0/track'],
    ['fa_get_flight_position', { id: 'UAL1-1-airline-0' }, '/flights/UAL1-1-airline-0/position'],
    ['fa_get_flight_route', { id: 'UAL1-1-airline-0' }, '/flights/UAL1-1-airline-0/route'],
    ['fa_get_flight_history', { ident: 'UAL123' }, '/history/flights/UAL123'],
  ])('%s hits the right path', async (tool, args, expected) => {
    const get = vi.spyOn(client, 'get').mockResolvedValue({});
    const h = await createTestHarness(registerFlightTools);
    await h.callTool(tool, args);
    expect(get.mock.calls[0][0]).toContain(expected);
    await h.close();
  });

  it('fa_resolve_flight uses the static cache tier', async () => {
    const get = vi.spyOn(client, 'get').mockResolvedValue({});
    const h = await createTestHarness(registerFlightTools);
    await h.callTool('fa_resolve_flight', { ident: 'UAL123' });
    expect(get.mock.calls[0][1]).toEqual({ cache: 'static' });
    await h.close();
  });

  it('rejects an ident that could escape the URL path', async () => {
    const get = vi.spyOn(client, 'get').mockResolvedValue({});
    const h = await createTestHarness(registerFlightTools);
    const res = await h.callTool('fa_get_flights', { ident: '../airports/KJFK' });
    expect(res.isError).toBe(true);
    expect(get).not.toHaveBeenCalled();
    await h.close();
  });

  it("rejects a bare '..' id, which fetch would normalise /flights/../track into /track", async () => {
    const get = vi.spyOn(client, 'get').mockResolvedValue({});
    const h = await createTestHarness(registerFlightTools);
    const res = await h.callTool('fa_get_flight_track', { id: '..' });
    expect(res.isError).toBe(true);
    expect(get).not.toHaveBeenCalled();
    await h.close();
  });
});
