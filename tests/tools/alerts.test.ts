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

  it('fa_get_alert reads a single alert by id', async () => {
    const get = vi.spyOn(client, 'get').mockResolvedValue({});
    const h = await createTestHarness(registerAlertTools);
    await h.callTool('fa_get_alert', { id: 7 });
    expect(get.mock.calls[0][0]).toBe('/alerts/7');
    await h.close();
  });

  it('fa_update_alert previews without confirm and PUTs with confirm', async () => {
    const write = vi.spyOn(client, 'write').mockResolvedValue({ status: 204, data: undefined });
    const h = await createTestHarness(registerAlertTools);
    const dry = parseToolResult<{ dryRun: boolean; method: string; path: string }>(
      await h.callTool('fa_update_alert', { id: 7, arrival: true }),
    );
    expect(dry.dryRun).toBe(true);
    expect(dry.method).toBe('PUT');
    expect(dry.path).toBe('/alerts/7');
    expect(write).not.toHaveBeenCalled();
    const done = parseToolResult<{ updated: boolean; alert_id: number }>(
      await h.callTool('fa_update_alert', { id: 7, arrival: true, confirm: true }),
    );
    expect(done.updated).toBe(true);
    expect(done.alert_id).toBe(7);
    expect(write).toHaveBeenCalledWith('PUT', '/alerts/7', expect.objectContaining({ events: { arrival: true } }));
    await h.close();
  });

  it('fa_get_alerts_endpoint reads the delivery endpoint', async () => {
    const get = vi.spyOn(client, 'get').mockResolvedValue({});
    const h = await createTestHarness(registerAlertTools);
    await h.callTool('fa_get_alerts_endpoint', {});
    expect(get.mock.calls[0][0]).toBe('/alerts/endpoint');
    await h.close();
  });

  it('fa_set_alerts_endpoint with confirm PUTs the endpoint', async () => {
    const write = vi.spyOn(client, 'write').mockResolvedValue({ status: 200, data: { url: 'https://example.com/hook' } });
    const h = await createTestHarness(registerAlertTools);
    const done = parseToolResult<{ updated: boolean }>(
      await h.callTool('fa_set_alerts_endpoint', { url: 'https://example.com/hook', confirm: true }),
    );
    expect(done.updated).toBe(true);
    expect(write).toHaveBeenCalledWith('PUT', '/alerts/endpoint', { url: 'https://example.com/hook' });
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
