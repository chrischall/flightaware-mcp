import { describe, it, expect, vi, afterEach } from 'vitest';
import { createTestHarness } from '@chrischall/mcp-utils/test';
import { registerAirportTools } from '../../src/tools/airports.js';
import { client } from '../../src/client.js';

afterEach(() => vi.restoreAllMocks());

describe('airport tools', () => {
  it('fa_get_airport_flights defaults to the all-flights board', async () => {
    const get = vi.spyOn(client, 'get').mockResolvedValue({});
    const h = await createTestHarness(registerAirportTools);
    await h.callTool('fa_get_airport_flights', { id: 'KJFK' });
    expect(get.mock.calls[0][0]).toMatch(/^\/airports\/KJFK\/flights(\?|$)/);
    await h.close();
  });

  it('fa_get_airport_flights routes a board into the sub-path', async () => {
    const get = vi.spyOn(client, 'get').mockResolvedValue({});
    const h = await createTestHarness(registerAirportTools);
    await h.callTool('fa_get_airport_flights', { id: 'KJFK', board: 'arrivals' });
    expect(get.mock.calls[0][0]).toContain('/airports/KJFK/flights/arrivals');
    await h.close();
  });

  it('fa_get_airport_delays uses the global board when no id is given', async () => {
    const get = vi.spyOn(client, 'get').mockResolvedValue({});
    const h = await createTestHarness(registerAirportTools);
    await h.callTool('fa_get_airport_delays', {});
    expect(get.mock.calls[0][0]).toMatch(/^\/airports\/delays/);
    await h.close();
  });

  it('fa_get_airport_delays scopes to one airport when id is given', async () => {
    const get = vi.spyOn(client, 'get').mockResolvedValue({});
    const h = await createTestHarness(registerAirportTools);
    await h.callTool('fa_get_airport_delays', { id: 'KORD' });
    expect(get.mock.calls[0][0]).toContain('/airports/KORD/delays');
    await h.close();
  });

  it('fa_get_nearby_airports passes lat/lon/radius', async () => {
    const get = vi.spyOn(client, 'get').mockResolvedValue({});
    const h = await createTestHarness(registerAirportTools);
    await h.callTool('fa_get_nearby_airports', { latitude: 40.6, longitude: -73.7, radius: 50 });
    const path = get.mock.calls[0][0];
    expect(path).toContain('latitude=40.6');
    expect(path).toContain('radius=50');
    await h.close();
  });

  it('fa_get_airport_flight_counts hits /airports/{id}/flights/counts', async () => {
    const get = vi.spyOn(client, 'get').mockResolvedValue({ departed: 1 });
    const h = await createTestHarness(registerAirportTools);
    await h.callTool('fa_get_airport_flight_counts', { id: 'KJFK' });
    expect(get.mock.calls[0][0]).toBe('/airports/KJFK/flights/counts');
    await h.close();
  });

  it('fa_get_airport_routes interpolates origin + destination', async () => {
    const get = vi.spyOn(client, 'get').mockResolvedValue({ routes: [] });
    const h = await createTestHarness(registerAirportTools);
    await h.callTool('fa_get_airport_routes', { id: 'KJFK', destination: 'KLAX' });
    expect(get.mock.calls[0][0]).toMatch(/^\/airports\/KJFK\/routes\/KLAX(\?|$)/);
    await h.close();
  });

  it('fa_resolve_airport hits /airports/{id}/canonical', async () => {
    const get = vi.spyOn(client, 'get').mockResolvedValue({});
    const h = await createTestHarness(registerAirportTools);
    await h.callTool('fa_resolve_airport', { id: 'JFK', id_type: 'iata' });
    const path = get.mock.calls[0][0];
    expect(path).toContain('/airports/JFK/canonical');
    expect(path).toContain('id_type=iata');
    await h.close();
  });

  it('rejects a non-alphanumeric airport code', async () => {
    const get = vi.spyOn(client, 'get').mockResolvedValue({});
    const h = await createTestHarness(registerAirportTools);
    const res = await h.callTool('fa_get_airport', { id: 'K/JFK' });
    expect(res.isError).toBe(true);
    expect(get).not.toHaveBeenCalled();
    await h.close();
  });
});
