import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { textResult } from '@chrischall/mcp-utils';
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
        id: OperatorCode.describe('Operator code (ICAO/IATA)'),
      },
    },
    async ({ id }) => {
      const data = await client.get(`/operators/${id}`);
      return textResult(data);
    },
  );

  server.registerTool(
    'fa_get_operator_flights',
    {
      description: 'Get a flight board for an operator (airline): all flights, or arrivals/departures/enroute/scheduled.',
      annotations: { readOnlyHint: true, openWorldHint: true },
      inputSchema: {
        id: OperatorCode.describe('Operator code (ICAO/IATA)'),
        board: z.enum(OPERATOR_BOARDS).default('all').describe('Which board to fetch (default: all)'),
        ...pageParams,
      },
    },
    async ({ id, board, max_pages, cursor }) => {
      const suffix = board === 'all' ? '' : `/${board}`;
      const data = await client.get(`/operators/${id}/flights${suffix}${qs({ max_pages, cursor })}`);
      return textResult(data);
    },
  );

  server.registerTool(
    'fa_list_operators',
    {
      description: 'List operators (airlines) known to AeroAPI (paged). Use the cursor to page through.',
      annotations: { readOnlyHint: true, openWorldHint: true },
      inputSchema: { ...pageParams },
    },
    async ({ max_pages, cursor }) => {
      const data = await client.get(`/operators${qs({ max_pages, cursor })}`);
      return textResult(data);
    },
  );
}
