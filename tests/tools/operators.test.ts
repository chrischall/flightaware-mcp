import { describe, it, expect, vi, afterEach } from 'vitest';
import { createTestHarness } from '@chrischall/mcp-utils/test';
import { registerOperatorTools } from '../../src/tools/operators.js';
import { registerAircraftTools } from '../../src/tools/aircraft.js';
import { client } from '../../src/client.js';

afterEach(() => vi.restoreAllMocks());

describe('operator + aircraft tools', () => {
  it('fa_get_operator_flights defaults to the all board', async () => {
    const get = vi.spyOn(client, 'get').mockResolvedValue({});
    const h = await createTestHarness(registerOperatorTools);
    await h.callTool('fa_get_operator_flights', { id: 'UAL' });
    expect(get.mock.calls[0][0]).toMatch(/^\/operators\/UAL\/flights(\?|$)/);
    await h.close();
  });

  it('fa_get_operator_flights routes enroute into the sub-path', async () => {
    const get = vi.spyOn(client, 'get').mockResolvedValue({});
    const h = await createTestHarness(registerOperatorTools);
    await h.callTool('fa_get_operator_flights', { id: 'UAL', board: 'enroute' });
    expect(get.mock.calls[0][0]).toContain('/operators/UAL/flights/enroute');
    await h.close();
  });

  it('fa_get_operator fetches operator info (static tier)', async () => {
    const get = vi.spyOn(client, 'get').mockResolvedValue({});
    const h = await createTestHarness(registerOperatorTools);
    await h.callTool('fa_get_operator', { id: 'UAL' });
    expect(get.mock.calls[0][0]).toBe('/operators/UAL');
    expect(get.mock.calls[0][1]).toEqual({ cache: 'static' });
    await h.close();
  });

  it('fa_list_operators lists (static tier)', async () => {
    const get = vi.spyOn(client, 'get').mockResolvedValue({ operators: [] });
    const h = await createTestHarness(registerOperatorTools);
    await h.callTool('fa_list_operators', {});
    expect(get.mock.calls[0][0]).toMatch(/^\/operators(\?|$)/);
    expect(get.mock.calls[0][1]).toEqual({ cache: 'static' });
    await h.close();
  });

  it('fa_get_aircraft_owner uses the static tier', async () => {
    const get = vi.spyOn(client, 'get').mockResolvedValue({});
    const h = await createTestHarness(registerAircraftTools);
    await h.callTool('fa_get_aircraft_owner', { ident: 'N1' });
    expect(get.mock.calls[0][1]).toEqual({ cache: 'static' });
    await h.close();
  });

  it('fa_get_aircraft_owner hits /aircraft/{ident}/owner', async () => {
    const get = vi.spyOn(client, 'get').mockResolvedValue({});
    const h = await createTestHarness(registerAircraftTools);
    await h.callTool('fa_get_aircraft_owner', { ident: 'N12345' });
    expect(get.mock.calls[0][0]).toBe('/aircraft/N12345/owner');
    await h.close();
  });
});
