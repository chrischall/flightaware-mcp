import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { textResult } from '@chrischall/mcp-utils';
import { client } from '../client.js';
import { AirportCode, OperatorCode, pageParams, qs } from './shared.js';

/** YYYY-MM-DD date (path segment for the schedules endpoint). */
const IsoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'must be a YYYY-MM-DD date');

export function registerScheduleTools(server: McpServer): void {
  server.registerTool(
    'fa_get_scheduled_flights',
    {
      description:
        'Get airline-scheduled flights between two dates (YYYY-MM-DD), optionally filtered by origin, destination, airline, or flight number.',
      annotations: { readOnlyHint: true, openWorldHint: true },
      inputSchema: {
        date_start: IsoDate.describe('Start date, YYYY-MM-DD'),
        date_end: IsoDate.describe('End date, YYYY-MM-DD'),
        origin: AirportCode.optional().describe('Filter by origin airport code'),
        destination: AirportCode.optional().describe('Filter by destination airport code'),
        airline: OperatorCode.optional().describe('Filter by operator (airline) code'),
        flight_number: z.string().regex(/^\d+$/, 'digits only').optional().describe('Filter by flight number'),
        include_codeshares: z.boolean().optional().describe('Include codeshare duplicates'),
        ...pageParams,
      },
    },
    async ({ date_start, date_end, origin, destination, airline, flight_number, include_codeshares, max_pages, cursor }) => {
      const data = await client.get(
        `/schedules/${date_start}/${date_end}${qs({ origin, destination, airline, flight_number, include_codeshares, max_pages, cursor })}`,
      );
      return textResult(data);
    },
  );

  server.registerTool(
    'fa_foresight_search',
    {
      description:
        'Predictive flight search via AeroAPI Foresight (Boolean query language, like fa_search_flights_advanced, but predicted data). NOTE: Foresight is a premium tier — expect a 402/403 unless your subscription includes it.',
      annotations: { readOnlyHint: true, openWorldHint: true },
      inputSchema: {
        query: z.string().min(1).describe('Boolean query expression'),
        ...pageParams,
      },
    },
    async ({ query, max_pages, cursor }) => {
      const data = await client.get(`/foresight/flights/search/advanced${qs({ query, max_pages, cursor })}`);
      return textResult(data);
    },
  );
}
