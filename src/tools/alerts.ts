import { z } from 'zod';
import type { McpServer, ServerContext } from '@modelcontextprotocol/server';
import {
  confirmationFromEnv,
  confirmTokenParam,
  minifiedResult,
  requireConfirmationWithFallback,
} from '@chrischall/mcp-utils';
import { viewArg, viewResponse } from '../view.js';
import { client } from '../client.js';
import { AirportCode, AlertId, FlightIdent, pageParams, qs } from './shared.js';

// The Alerts API requires a Standard/Premium AeroAPI tier; the free Personal
// tier returns 401 for every /alerts endpoint. Surfaced in each tool's
// description so the gating is obvious before the call.
const TIER = ' Requires a Standard or Premium AeroAPI tier (the free Personal tier returns 401).';

// How every alert mutation asks before it writes, appended to its description.
const CONFIRM =
  ' Asks the user to confirm first: a confirmation prompt where the client supports one; otherwise the first call returns a preview of the request (method, path, body) and a confirmToken, makes NO network call, and only a repeat call with that token proceeds (see MCP_CONFIRM_MODE).';

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
  const { eta, arrival, departure, cancelled, diverted, filed, hold, ...rest } = args as Record<
    string,
    unknown
  >;
  const events: Record<string, boolean> = {};
  for (const [k, v] of Object.entries({
    eta,
    arrival,
    departure,
    cancelled,
    diverted,
    filed,
    hold,
  })) {
    if (typeof v === 'boolean') events[k] = v;
  }
  const body: Record<string, unknown> = { ...rest };
  if (Object.keys(events).length > 0) body.events = events;
  return body;
}

/** The exact request an alert mutation will send — shown to the user and hashed into the token. */
interface AlertWrite {
  method: 'POST' | 'PUT' | 'DELETE';
  path: string;
  body?: Record<string, unknown>;
}

/**
 * Gate an alert mutation on the user's confirmation. `undefined` means
 * proceed; anything else is the result to return (a prompt, a phase-1
 * preview + confirmToken, or a refusal).
 */
function confirmAlertWrite(
  ctx: ServerContext,
  opts: {
    tool: string;
    action: string;
    message: string;
    target: string;
    confirmToken: string | undefined;
    request: AlertWrite;
  },
) {
  const { tool, action, message, target, confirmToken, request } = opts;
  const preview: Record<string, unknown> = { ...request };
  return requireConfirmationWithFallback(
    ctx,
    confirmationFromEnv({
      action,
      message,
      details: preview,
      tool,
      confirmToken,
      subject: () => ({ target, payload: request, preview }),
    }),
  );
}

export function registerAlertTools(server: McpServer): void {
  server.registerTool(
    'fa_list_alerts',
    {
      description: 'List the flight alerts configured on your AeroAPI account.' + TIER,
      annotations: { readOnlyHint: true, openWorldHint: true },
      inputSchema: z.object({
        view: viewArg(),
        ...pageParams,
      }),
    },
    async ({ max_pages, cursor, view }) => {
      const data = await client.get(`/alerts${qs({ max_pages, cursor })}`);
      return viewResponse(view, data);
    },
  );

  server.registerTool(
    'fa_get_alert',
    {
      description: 'Get a single configured flight alert by its id.' + TIER,
      annotations: { readOnlyHint: true, openWorldHint: true },
      inputSchema: z.object({
        view: viewArg(),
        id: AlertId.describe('Alert id'),
      }),
    },
    async ({ id, view }) => {
      const data = await client.get(`/alerts/${id}`);
      return viewResponse(view, data);
    },
  );

  server.registerTool(
    'fa_create_alert',
    {
      description:
        'Create a flight alert on your AeroAPI account.' + CONFIRM + TIER,
      annotations: {
        readOnlyHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
      inputSchema: z.object({ ...alertConfigSchema, confirmToken: confirmTokenParam }),
    },
    async ({ confirmToken, ...args }, ctx) => {
      const body = buildAlertBody(args as Record<string, unknown>);
      const gate = await confirmAlertWrite(ctx, {
        tool: 'fa_create_alert',
        action: 'alerts.create',
        message: 'Review and confirm creating this flight alert:',
        target: '',
        confirmToken,
        request: { method: 'POST', path: '/alerts', body },
      });
      if (gate) return gate;
      const res = await client.write('POST', '/alerts', body);
      return minifiedResult({
        created: true,
        alert_id: res.locationId,
        status: res.status,
        alert: res.data,
      });
    },
  );

  server.registerTool(
    'fa_update_alert',
    {
      description:
        'Update an existing flight alert (replaces its configuration).' + CONFIRM + TIER,
      annotations: {
        readOnlyHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
      inputSchema: z.object({
        id: AlertId.describe('Alert id to update'),
        ...alertConfigSchema,
        confirmToken: confirmTokenParam,
      }),
    },
    async ({ id, confirmToken, ...args }, ctx) => {
      const body = buildAlertBody(args as Record<string, unknown>);
      const path = `/alerts/${id}`;
      const gate = await confirmAlertWrite(ctx, {
        tool: 'fa_update_alert',
        action: 'alerts.update',
        message: 'Review and confirm replacing this flight alert:',
        target: String(id),
        confirmToken,
        request: { method: 'PUT', path, body },
      });
      if (gate) return gate;
      const res = await client.write('PUT', path, body);
      return minifiedResult({
        updated: true,
        alert_id: id,
        status: res.status,
        alert: res.data,
      });
    },
  );

  server.registerTool(
    'fa_delete_alert',
    {
      description:
        'Delete a flight alert by id.' + CONFIRM + TIER,
      annotations: {
        readOnlyHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
      inputSchema: z.object({
        id: AlertId.describe('Alert id to delete'),
        confirmToken: confirmTokenParam,
      }),
    },
    async ({ id, confirmToken }, ctx) => {
      const path = `/alerts/${id}`;
      const gate = await confirmAlertWrite(ctx, {
        tool: 'fa_delete_alert',
        action: 'alerts.delete',
        message: 'Review and confirm deleting this flight alert:',
        target: String(id),
        confirmToken,
        request: { method: 'DELETE', path },
      });
      if (gate) return gate;
      const res = await client.write('DELETE', path);
      return minifiedResult({
        deleted: true,
        alert_id: id,
        status: res.status,
      });
    },
  );

  server.registerTool(
    'fa_get_alerts_endpoint',
    {
      description:
        'Get the current delivery (webhook) endpoint configured for your AeroAPI alerts.' + TIER,
      annotations: { readOnlyHint: true, openWorldHint: true },
      inputSchema: z.object({
        view: viewArg(),
      }),
    },
    async ({ view }) => {
      const data = await client.get('/alerts/endpoint');
      return viewResponse(view, data);
    },
  );

  server.registerTool(
    'fa_set_alerts_endpoint',
    {
      description:
        'Set the delivery (webhook) endpoint AeroAPI POSTs alert notifications to.' + CONFIRM + TIER,
      annotations: {
        readOnlyHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
      inputSchema: z.object({
        url: z.string().url().describe('HTTPS URL AeroAPI will POST alert payloads to'),
        format: z.enum(['json', 'json/post', 'xml']).optional().describe('Delivery payload format'),
        confirmToken: confirmTokenParam,
      }),
    },
    async ({ url, format, confirmToken }, ctx) => {
      const body: Record<string, unknown> = { url };
      if (format) body.format = format;
      const gate = await confirmAlertWrite(ctx, {
        tool: 'fa_set_alerts_endpoint',
        action: 'alerts.set_endpoint',
        message: 'Review and confirm changing the alert delivery endpoint:',
        target: '/alerts/endpoint',
        confirmToken,
        request: { method: 'PUT', path: '/alerts/endpoint', body },
      });
      if (gate) return gate;
      const res = await client.write('PUT', '/alerts/endpoint', body);
      return minifiedResult({
        updated: true,
        status: res.status,
        endpoint: res.data,
      });
    },
  );
}
