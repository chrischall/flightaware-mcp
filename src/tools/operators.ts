import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { viewArg, viewResponse } from '../view.js';
import { client } from '../client.js';
import { OperatorCode, pageParams, qs } from './shared.js';

const OPERATOR_BOARDS = ['all', 'arrivals', 'departures', 'enroute', 'scheduled'] as const;

export function registerOperatorTools(server: McpServer): void {
  server.registerTool(
    'fa_get_operator',
    {
      description: 'Get details for an operator (airline) by code (ICAO like UAL, or IATA like UA).',
      annotations: { readOnlyHint: true, openWorldHint: true },
      inputSchema: {
        view: viewArg(),
        id: OperatorCode.describe('Operator code (ICAO/IATA)'),
      },
    },
    async ({ id, view }) => {
      const data = await client.get(`/operators/${id}`, { cache: 'static' });
      return viewResponse(view, data);
    },
  );

  server.registerTool(
    'fa_get_operator_flights',
    {
      description: 'Get a flight board for an operator (airline): all flights, or arrivals/departures/enroute/scheduled.',
      annotations: { readOnlyHint: true, openWorldHint: true },
      inputSchema: {
        view: viewArg(),
        id: OperatorCode.describe('Operator code (ICAO/IATA)'),
        board: z.enum(OPERATOR_BOARDS).default('all').describe('Which board to fetch (default: all)'),
        ...pageParams,
      },
    },
    async ({ id, board, max_pages, cursor, view }) => {
      const suffix = board === 'all' ? '' : `/${board}`;
      const data = await client.get(`/operators/${id}/flights${suffix}${qs({ max_pages, cursor })}`);
      return viewResponse(view, data);
    },
  );

  server.registerTool(
    'fa_list_operators',
    {
      description: 'List operators (airlines) known to AeroAPI (paged). Use the cursor to page through.',
      annotations: { readOnlyHint: true, openWorldHint: true },
      inputSchema: {
        view: viewArg(), ...pageParams },
    },
    async ({ max_pages, cursor, view }) => {
      const data = await client.get(`/operators${qs({ max_pages, cursor })}`, { cache: 'static' });
      return viewResponse(view, data);
    },
  );
}
