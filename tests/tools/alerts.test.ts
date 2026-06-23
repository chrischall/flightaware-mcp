import { describe, it, expect, vi, afterEach } from 'vitest';
import { createTestHarness, parseToolResult } from '@chrischall/mcp-utils/test';
import { registerAlertTools } from '../../src/tools/alerts.js';
import { client } from '../../src/client.js';

afterEach(() => vi.restoreAllMocks());

describe('alert tools — confirm gating', () => {
  it('fa_create_alert without confirm returns a dry-run preview and makes NO network call', async () => {
    const write = vi.spyOn(client, 'write');
    const h = await createTestHarness(registerAlertTools);
    const res = await h.callTool('fa_create_alert', { ident: 'UAL123', arrival: true, departure: false });
    const data = parseToolResult<{ dryRun: boolean; method: string; path: string; body: Record<string, unknown> }>(res);
    expect(data.dryRun).toBe(true);
    expect(data.method).toBe('POST');
    expect(data.path).toBe('/alerts');
    // Event booleans are nested under `events`.
    expect(data.body).toMatchObject({ ident: 'UAL123', events: { arrival: true, departure: false } });
    expect(write).not.toHaveBeenCalled();
    await h.close();
  });

  it('fa_create_alert with confirm:true POSTs and surfaces the new id from Location', async () => {
    const write = vi.spyOn(client, 'write').mockResolvedValue({ status: 201, locationId: '424242', data: undefined });
    const h = await createTestHarness(registerAlertTools);
    const res = await h.callTool('fa_create_alert', { ident: 'UAL123', confirm: true });
    const data = parseToolResult<{ created: boolean; alert_id: string }>(res);
    expect(data.created).toBe(true);
    expect(data.alert_id).toBe('424242');
    expect(write).toHaveBeenCalledWith('POST', '/alerts', expect.objectContaining({ ident: 'UAL123' }));
    await h.close();
  });

  it('fa_delete_alert without confirm previews and does not call write', async () => {
    const write = vi.spyOn(client, 'write');
    const h = await createTestHarness(registerAlertTools);
    const res = await h.callTool('fa_delete_alert', { id: 99 });
    const data = parseToolResult<{ dryRun: boolean; method: string }>(res);
    expect(data.dryRun).toBe(true);
    expect(data.method).toBe('DELETE');
    expect(write).not.toHaveBeenCalled();
    await h.close();
  });

  it('fa_delete_alert with confirm:true issues the DELETE', async () => {
    const write = vi.spyOn(client, 'write').mockResolvedValue({ status: 204, data: undefined });
    const h = await createTestHarness(registerAlertTools);
    const res = await h.callTool('fa_delete_alert', { id: 99, confirm: true });
    const data = parseToolResult<{ deleted: boolean; alert_id: number }>(res);
    expect(data.deleted).toBe(true);
    expect(data.alert_id).toBe(99);
    expect(write).toHaveBeenCalledWith('DELETE', '/alerts/99');
    await h.close();
  });

  it('fa_set_alerts_endpoint without confirm previews the PUT body', async () => {
    const write = vi.spyOn(client, 'write');
    const h = await createTestHarness(registerAlertTools);
    const res = await h.callTool('fa_set_alerts_endpoint', { url: 'https://example.com/hook', format: 'json' });
    const data = parseToolResult<{ dryRun: boolean; body: Record<string, unknown> }>(res);
    expect(data.dryRun).toBe(true);
    expect(data.body).toMatchObject({ url: 'https://example.com/hook', format: 'json' });
    expect(write).not.toHaveBeenCalled();
    await h.close();
  });

  it('fa_list_alerts is a plain read', async () => {
    const get = vi.spyOn(client, 'get').mockResolvedValue({ alerts: [] });
    const h = await createTestHarness(registerAlertTools);
    await h.callTool('fa_list_alerts', {});
    expect(get.mock.calls[0][0]).toMatch(/^\/alerts/);
    await h.close();
  });
});
