import { describe, it, expect, vi, afterEach } from 'vitest';
import { createTestHarness, parseToolResult } from '@chrischall/mcp-utils/test';
import { registerFlightTools } from '../../src/tools/flights.js';
import { client } from '../../src/client.js';

afterEach(() => vi.restoreAllMocks());

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
    const h = await createTestHarness(registerFlightTools);
    const res = await h.callTool('fa_get_flight_map', { id: 'UAL123-1700000000-airline-0123', output_dir: '/tmp' });
    const data = parseToolResult<{ map: string }>(res);
    expect(data.map).toMatch(/\/tmp\/flight-map-UAL123-1700000000-airline-0123.*\.png$/);
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

  it('rejects an ident that could escape the URL path', async () => {
    const get = vi.spyOn(client, 'get').mockResolvedValue({});
    const h = await createTestHarness(registerFlightTools);
    const res = await h.callTool('fa_get_flights', { ident: '../airports/KJFK' });
    expect(res.isError).toBe(true);
    expect(get).not.toHaveBeenCalled();
    await h.close();
  });
});
