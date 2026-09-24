import { describe, it, expect, vi, afterEach } from 'vitest';
import { createTestHarness, parseToolResult } from '@chrischall/mcp-utils/test';
import { registerAlertTools } from '../../src/tools/alerts.js';
import { client } from '../../src/client.js';

const ENV_KEYS = ['MCP_CONFIRM_MODE', 'MCP_CONFIRM_TTL_SECONDS', 'MCP_CONFIRM_SECRET'] as const;
const savedEnv = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));

afterEach(() => {
  vi.restoreAllMocks();
  for (const k of ENV_KEYS) {
    if (savedEnv[k] === undefined) delete process.env[k];
    else process.env[k] = savedEnv[k];
  }
});

interface PhaseOne {
  status: string;
  confirmed: boolean;
  dispatched: boolean;
  action: string;
  confirmToken: string;
  preview: { method: string; path: string; body?: Record<string, unknown> };
}

interface Rejection {
  status: string;
  error: string;
  reason?: string;
  confirmToken?: string;
}

describe('alert tools — confirm-token gating (client without elicitation)', () => {
  it('fa_create_alert phase 1 returns a preview + token and makes NO network call; phase 2 POSTs once', async () => {
    const write = vi.spyOn(client, 'write').mockResolvedValue({ status: 201, locationId: '424242', data: undefined });
    const h = await createTestHarness(registerAlertTools);
    const args = { ident: 'UAL123', arrival: true, departure: false };
    const one = parseToolResult<PhaseOne>(await h.callTool('fa_create_alert', args));
    expect(one.status).toBe('confirmation-required');
    expect(one.action).toBe('alerts.create');
    expect(one.preview.method).toBe('POST');
    expect(one.preview.path).toBe('/alerts');
    // Event booleans are nested under `events`.
    expect(one.preview.body).toMatchObject({ ident: 'UAL123', events: { arrival: true, departure: false } });
    expect(typeof one.confirmToken).toBe('string');
    expect(write).not.toHaveBeenCalled();

    const res = await h.callTool('fa_create_alert', { ...args, confirmToken: one.confirmToken });
    const data = parseToolResult<{ created: boolean; alert_id: string }>(res);
    expect(data.created).toBe(true);
    expect(data.alert_id).toBe('424242');
    expect(write).toHaveBeenCalledTimes(1);
    expect(write).toHaveBeenCalledWith('POST', '/alerts', {
      ident: 'UAL123',
      events: { arrival: true, departure: false },
    });
    await h.close();
  });

  it('fa_update_alert phase 1 previews the PUT; phase 2 PUTs once', async () => {
    const write = vi.spyOn(client, 'write').mockResolvedValue({ status: 204, data: undefined });
    const h = await createTestHarness(registerAlertTools);
    const one = parseToolResult<PhaseOne>(await h.callTool('fa_update_alert', { id: 7, arrival: true }));
    expect(one.status).toBe('confirmation-required');
    expect(one.action).toBe('alerts.update');
    expect(one.preview).toEqual({ method: 'PUT', path: '/alerts/7', body: { events: { arrival: true } } });
    expect(write).not.toHaveBeenCalled();
    const done = parseToolResult<{ updated: boolean; alert_id: number }>(
      await h.callTool('fa_update_alert', { id: 7, arrival: true, confirmToken: one.confirmToken }),
    );
    expect(done.updated).toBe(true);
    expect(done.alert_id).toBe(7);
    expect(write).toHaveBeenCalledTimes(1);
    expect(write).toHaveBeenCalledWith('PUT', '/alerts/7', { events: { arrival: true } });
    await h.close();
  });

  it('fa_delete_alert phase 1 previews the DELETE; phase 2 deletes once', async () => {
    const write = vi.spyOn(client, 'write').mockResolvedValue({ status: 204, data: undefined });
    const h = await createTestHarness(registerAlertTools);
    const one = parseToolResult<PhaseOne>(await h.callTool('fa_delete_alert', { id: 99 }));
    expect(one.status).toBe('confirmation-required');
    expect(one.action).toBe('alerts.delete');
    expect(one.preview).toEqual({ method: 'DELETE', path: '/alerts/99' });
    expect(write).not.toHaveBeenCalled();
    const data = parseToolResult<{ deleted: boolean; alert_id: number }>(
      await h.callTool('fa_delete_alert', { id: 99, confirmToken: one.confirmToken }),
    );
    expect(data.deleted).toBe(true);
    expect(data.alert_id).toBe(99);
    expect(write).toHaveBeenCalledTimes(1);
    expect(write).toHaveBeenCalledWith('DELETE', '/alerts/99');
    await h.close();
  });

  it('fa_set_alerts_endpoint phase 1 previews the PUT body; phase 2 PUTs once', async () => {
    const write = vi
      .spyOn(client, 'write')
      .mockResolvedValue({ status: 200, data: { url: 'https://example.com/hook' } });
    const h = await createTestHarness(registerAlertTools);
    const args = { url: 'https://example.com/hook', format: 'json' as const };
    const one = parseToolResult<PhaseOne>(await h.callTool('fa_set_alerts_endpoint', args));
    expect(one.status).toBe('confirmation-required');
    expect(one.action).toBe('alerts.set_endpoint');
    expect(one.preview).toEqual({
      method: 'PUT',
      path: '/alerts/endpoint',
      body: { url: 'https://example.com/hook', format: 'json' },
    });
    expect(write).not.toHaveBeenCalled();
    const done = parseToolResult<{ updated: boolean }>(
      await h.callTool('fa_set_alerts_endpoint', { ...args, confirmToken: one.confirmToken }),
    );
    expect(done.updated).toBe(true);
    expect(write).toHaveBeenCalledTimes(1);
    expect(write).toHaveBeenCalledWith('PUT', '/alerts/endpoint', { url: 'https://example.com/hook', format: 'json' });
    await h.close();
  });

  it('fa_set_alerts_endpoint omits format from the body when not given', async () => {
    const write = vi.spyOn(client, 'write').mockResolvedValue({ status: 200, data: {} });
    const h = await createTestHarness(registerAlertTools);
    const one = parseToolResult<PhaseOne>(await h.callTool('fa_set_alerts_endpoint', { url: 'https://example.com/hook' }));
    expect(one.preview.body).toEqual({ url: 'https://example.com/hook' });
    await h.callTool('fa_set_alerts_endpoint', { url: 'https://example.com/hook', confirmToken: one.confirmToken });
    expect(write).toHaveBeenCalledWith('PUT', '/alerts/endpoint', { url: 'https://example.com/hook' });
    await h.close();
  });

  it('replaying a used token is refused as TOKEN_REUSED and does not write again', async () => {
    const write = vi.spyOn(client, 'write').mockResolvedValue({ status: 204, data: undefined });
    const h = await createTestHarness(registerAlertTools);
    const one = parseToolResult<PhaseOne>(await h.callTool('fa_delete_alert', { id: 5 }));
    await h.callTool('fa_delete_alert', { id: 5, confirmToken: one.confirmToken });
    expect(write).toHaveBeenCalledTimes(1);
    const replay = await h.callTool('fa_delete_alert', { id: 5, confirmToken: one.confirmToken });
    expect(replay.isError).toBe(true);
    expect(parseToolResult<Rejection>(replay).error).toBe('TOKEN_REUSED');
    expect(write).toHaveBeenCalledTimes(1);
    await h.close();
  });

  it('changing an argument between the phases is refused as DRAFT_CHANGED and does not write', async () => {
    const write = vi.spyOn(client, 'write').mockResolvedValue({ status: 201, locationId: '1', data: undefined });
    const h = await createTestHarness(registerAlertTools);
    const one = parseToolResult<PhaseOne>(await h.callTool('fa_create_alert', { ident: 'UAL123' }));
    const changed = await h.callTool('fa_create_alert', { ident: 'DAL456', confirmToken: one.confirmToken });
    expect(changed.isError).toBe(true);
    const data = parseToolResult<Rejection>(changed);
    expect(data.error).toBe('DRAFT_CHANGED');
    expect(data.reason).toBe('payload-changed');
    expect(write).not.toHaveBeenCalled();
    await h.close();
  });

  it('a token never crosses to a different alert id', async () => {
    const write = vi.spyOn(client, 'write').mockResolvedValue({ status: 204, data: undefined });
    const h = await createTestHarness(registerAlertTools);
    const one = parseToolResult<PhaseOne>(await h.callTool('fa_delete_alert', { id: 1 }));
    const other = await h.callTool('fa_delete_alert', { id: 2, confirmToken: one.confirmToken });
    expect(other.isError).toBe(true);
    expect(write).not.toHaveBeenCalled();
    await h.close();
  });

  it('MCP_CONFIRM_MODE=refuse refuses the write on a client that cannot be prompted', async () => {
    process.env.MCP_CONFIRM_MODE = 'refuse';
    const write = vi.spyOn(client, 'write');
    const h = await createTestHarness(registerAlertTools);
    const res = await h.callTool('fa_delete_alert', { id: 99 });
    const data = parseToolResult<{ reason: string; dispatched: boolean }>(res);
    expect(data.reason).toBe('confirmation-unsupported');
    expect(data.dispatched).toBe(false);
    expect(write).not.toHaveBeenCalled();
    await h.close();
  });
});

describe('alert tools — elicitation (client that can be prompted)', () => {
  it('writes once when the user accepts the prompt', async () => {
    const write = vi.spyOn(client, 'write').mockResolvedValue({ status: 204, data: undefined });
    const elicitation = vi.fn(async () => ({ action: 'accept' as const, content: { confirmed: true } }));
    const h = await createTestHarness(registerAlertTools, { elicitation });
    const data = parseToolResult<{ deleted: boolean }>(await h.callTool('fa_delete_alert', { id: 99 }));
    expect(elicitation).toHaveBeenCalledTimes(1);
    expect(data.deleted).toBe(true);
    expect(write).toHaveBeenCalledTimes(1);
    expect(write).toHaveBeenCalledWith('DELETE', '/alerts/99');
    await h.close();
  });

  it('does not write when the user declines the prompt', async () => {
    const write = vi.spyOn(client, 'write');
    const h = await createTestHarness(registerAlertTools, {
      elicitation: async () => ({ action: 'decline' as const }),
    });
    const data = parseToolResult<{ confirmed: boolean; cancelled: boolean }>(
      await h.callTool('fa_create_alert', { ident: 'UAL123' }),
    );
    expect(data.confirmed).toBe(false);
    expect(data.cancelled).toBe(true);
    expect(write).not.toHaveBeenCalled();
    await h.close();
  });
});

describe('alert tools — reads', () => {
  it('fa_get_alert reads a single alert by id', async () => {
    const get = vi.spyOn(client, 'get').mockResolvedValue({});
    const h = await createTestHarness(registerAlertTools);
    await h.callTool('fa_get_alert', { id: 7 });
    expect(get.mock.calls[0][0]).toBe('/alerts/7');
    await h.close();
  });

  it('fa_get_alerts_endpoint reads the delivery endpoint', async () => {
    const get = vi.spyOn(client, 'get').mockResolvedValue({});
    const h = await createTestHarness(registerAlertTools);
    await h.callTool('fa_get_alerts_endpoint', {});
    expect(get.mock.calls[0][0]).toBe('/alerts/endpoint');
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
