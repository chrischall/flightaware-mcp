import { describe, it, expect, vi, afterEach } from 'vitest';
import { createTestHarness } from '@chrischall/mcp-utils/test';
import { registerScheduleTools } from '../../src/tools/schedules.js';
import { client } from '../../src/client.js';

afterEach(() => vi.restoreAllMocks());

describe('schedule + foresight tools', () => {
  it('fa_get_scheduled_flights interpolates the date range into the path', async () => {
    const get = vi.spyOn(client, 'get').mockResolvedValue({ scheduled: [] });
    const h = await createTestHarness(registerScheduleTools);
    await h.callTool('fa_get_scheduled_flights', { date_start: '2026-07-01', date_end: '2026-07-02', origin: 'KJFK' });
    const path = get.mock.calls[0][0];
    expect(path).toContain('/schedules/2026-07-01/2026-07-02');
    expect(path).toContain('origin=KJFK');
    await h.close();
  });

  it('fa_get_scheduled_flights rejects a malformed date', async () => {
    const get = vi.spyOn(client, 'get').mockResolvedValue({});
    const h = await createTestHarness(registerScheduleTools);
    const res = await h.callTool('fa_get_scheduled_flights', { date_start: '07/01/2026', date_end: '2026-07-02' });
    expect(res.isError).toBe(true);
    expect(get).not.toHaveBeenCalled();
    await h.close();
  });

  it('fa_foresight_search hits the foresight advanced-search path', async () => {
    const get = vi.spyOn(client, 'get').mockResolvedValue({ flights: [] });
    const h = await createTestHarness(registerScheduleTools);
    await h.callTool('fa_foresight_search', { query: '{= origin KORD}' });
    expect(get.mock.calls[0][0]).toContain('/foresight/flights/search/advanced');
    await h.close();
  });
});
