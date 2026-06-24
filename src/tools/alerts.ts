import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { textResult, schemaConfirm } from '@chrischall/mcp-utils';
import { client } from '../client.js';
import { AirportCode, AlertId, FlightIdent, pageParams, qs } from './shared.js';

// The Alerts API requires a Standard/Premium AeroAPI tier; the free Personal
// tier returns 401 for every /alerts endpoint. Surfaced in each tool's
// description so the gating is obvious before the call.
const TIER = ' Requires a Standard or Premium AeroAPI tier (the free Personal tier returns 401).';

/** The mutable fields of a flight alert (shared by create + update). */
const alertConfigSchema = {
  ident: FlightIdent.optional().describe('Flight ident / designator to watch (e.g. UAL123)'),
  origin: AirportCode.optional().describe('Origin airport code filter'),
  destination: AirportCode.optional().describe('Destination airport code filter'),
  aircraft_type: z.string().optional().describe('ICAO aircraft type filter (e.g. B738)'),
  start_date: z.string().optional().describe('ISO-8601 date the alert becomes active'),
  end_date: z.string().optional().describe('ISO-8601 date the alert expires'),
  max_weekly: z.number().int().min(0).optional().describe('Cap on notifications per week'),
  // Event toggles — which lifecycle events fire a notification.
  eta: z.boolean().optional().describe('Notify on ETA changes'),
  arrival: z.boolean().optional().describe('Notify on arrival'),
  departure: z.boolean().optional().describe('Notify on departure'),
  cancelled: z.boolean().optional().describe('Notify on cancellation'),
  diverted: z.boolean().optional().describe('Notify on diversion'),
  filed: z.boolean().optional().describe('Notify when a flight plan is filed'),
  hold: z.boolean().optional().describe('Notify on hold'),
};

/** Pull the lifecycle-event booleans into AeroAPI's nested `events` object. */
function buildAlertBody(args: Record<string, unknown>): Record<string, unknown> {
  const { eta, arrival, departure, cancelled, diverted, filed, hold, ...rest } = args as Record<string, unknown>;
  const events: Record<string, boolean> = {};
  for (const [k, v] of Object.entries({ eta, arrival, departure, cancelled, diverted, filed, hold })) {
    if (typeof v === 'boolean') events[k] = v;
  }
  const body: Record<string, unknown> = { ...rest };
  if (Object.keys(events).length > 0) body.events = events;
  return body;
}

export function registerAlertTools(server: McpServer): void {
  server.registerTool(
    'fa_list_alerts',
    {
      description: 'List the flight alerts configured on your AeroAPI account.' + TIER,
      annotations: { readOnlyHint: true, openWorldHint: true },
      inputSchema: { ...pageParams },
    },
    async ({ max_pages, cursor }) => {
      const data = await client.get(`/alerts${qs({ max_pages, cursor })}`);
      return textResult(data);
    },
  );

  server.registerTool(
    'fa_get_alert',
    {
      description: 'Get a single configured flight alert by its id.' + TIER,
      annotations: { readOnlyHint: true, openWorldHint: true },
      inputSchema: { id: AlertId.describe('Alert id') },
    },
    async ({ id }) => {
      const data = await client.get(`/alerts/${id}`);
      return textResult(data);
    },
  );

  server.registerTool(
    'fa_create_alert',
    {
      description:
        'Create a flight alert on your AeroAPI account. Without confirm:true this returns a dry-run preview of the request and makes NO network call; with confirm:true it creates the alert.' + TIER,
      annotations: { readOnlyHint: false, idempotentHint: false, openWorldHint: true },
      inputSchema: { ...alertConfigSchema, confirm: schemaConfirm },
    },
    async ({ confirm, ...args }) => {
      const body = buildAlertBody(args as Record<string, unknown>);
      if (confirm !== true) {
        return textResult({ dryRun: true, method: 'POST', path: '/alerts', body, note: 'Dry run — re-run with confirm:true to create this alert.' });
      }
      const res = await client.write('POST', '/alerts', body);
      return textResult({ created: true, alert_id: res.locationId, status: res.status, alert: res.data });
    },
  );

  server.registerTool(
    'fa_update_alert',
    {
      description:
        'Update an existing flight alert (replaces its configuration). Without confirm:true this returns a dry-run preview and makes NO network call; with confirm:true it applies the update.' + TIER,
      annotations: { readOnlyHint: false, idempotentHint: true, openWorldHint: true },
      inputSchema: { id: AlertId.describe('Alert id to update'), ...alertConfigSchema, confirm: schemaConfirm },
    },
    async ({ id, confirm, ...args }) => {
      const body = buildAlertBody(args as Record<string, unknown>);
      const path = `/alerts/${id}`;
      if (confirm !== true) {
        return textResult({ dryRun: true, method: 'PUT', path, body, note: 'Dry run — re-run with confirm:true to update this alert.' });
      }
      const res = await client.write('PUT', path, body);
      return textResult({ updated: true, alert_id: id, status: res.status, alert: res.data });
    },
  );

  server.registerTool(
    'fa_delete_alert',
    {
      description:
        'Delete a flight alert by id. Without confirm:true this returns a dry-run preview and makes NO network call; with confirm:true it deletes the alert.' + TIER,
      annotations: { readOnlyHint: false, idempotentHint: true, openWorldHint: true },
      inputSchema: { id: AlertId.describe('Alert id to delete'), confirm: schemaConfirm },
    },
    async ({ id, confirm }) => {
      const path = `/alerts/${id}`;
      if (confirm !== true) {
        return textResult({ dryRun: true, method: 'DELETE', path, note: 'Dry run — re-run with confirm:true to delete this alert.' });
      }
      const res = await client.write('DELETE', path);
      return textResult({ deleted: true, alert_id: id, status: res.status });
    },
  );

  server.registerTool(
    'fa_get_alerts_endpoint',
    {
      description: 'Get the current delivery (webhook) endpoint configured for your AeroAPI alerts.' + TIER,
      annotations: { readOnlyHint: true, openWorldHint: true },
      inputSchema: {},
    },
    async () => {
      const data = await client.get('/alerts/endpoint');
      return textResult(data);
    },
  );

  server.registerTool(
    'fa_set_alerts_endpoint',
    {
      description:
        'Set the delivery (webhook) endpoint AeroAPI POSTs alert notifications to. Without confirm:true this returns a dry-run preview and makes NO network call; with confirm:true it applies the change.' + TIER,
      annotations: { readOnlyHint: false, idempotentHint: true, openWorldHint: true },
      inputSchema: {
        url: z.string().url().describe('HTTPS URL AeroAPI will POST alert payloads to'),
        format: z.enum(['json', 'json/post', 'xml']).optional().describe('Delivery payload format'),
        confirm: schemaConfirm,
      },
    },
    async ({ url, format, confirm }) => {
      const body: Record<string, unknown> = { url };
      if (format) body.format = format;
      if (confirm !== true) {
        return textResult({ dryRun: true, method: 'PUT', path: '/alerts/endpoint', body, note: 'Dry run — re-run with confirm:true to set the delivery endpoint.' });
      }
      const res = await client.write('PUT', '/alerts/endpoint', body);
      return textResult({ updated: true, status: res.status, endpoint: res.data });
    },
  );
}
