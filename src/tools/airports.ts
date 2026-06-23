import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { textResult } from '@chrischall/mcp-utils';
import { client } from '../client.js';
import { AirportCode, pageParams, dateWindowParams, qs } from './shared.js';

/** Board variants map to AeroAPI airport sub-paths (`all` → the base /flights). */
const BOARDS = ['all', 'arrivals', 'departures', 'scheduled_arrivals', 'scheduled_departures'] as const;

export function registerAirportTools(server: McpServer): void {
  server.registerTool(
    'fa_get_airport',
    {
      description: 'Get details for an airport by code (ICAO like KJFK, IATA like JFK, or LID).',
      annotations: { readOnlyHint: true, openWorldHint: true },
      inputSchema: {
        id: AirportCode.describe('Airport code (ICAO/IATA/LID)'),
      },
    },
    async ({ id }) => {
      const data = await client.get(`/airports/${id}`);
      return textResult(data);
    },
  );

  server.registerTool(
    'fa_get_airport_flights',
    {
      description:
        'Get a flight board for an airport: all flights, or just arrivals/departures/scheduled_arrivals/scheduled_departures.',
      annotations: { readOnlyHint: true, openWorldHint: true },
      inputSchema: {
        id: AirportCode.describe('Airport code (ICAO/IATA/LID)'),
        board: z.enum(BOARDS).default('all').describe('Which board to fetch (default: all)'),
        type: z.enum(['Airline', 'General_Aviation']).optional().describe('Restrict to airline or GA traffic'),
        ...dateWindowParams,
        ...pageParams,
      },
    },
    async ({ id, board, type, start, end, max_pages, cursor }) => {
      const suffix = board === 'all' ? '' : `/${board}`;
      const data = await client.get(`/airports/${id}/flights${suffix}${qs({ type, start, end, max_pages, cursor })}`);
      return textResult(data);
    },
  );

  server.registerTool(
    'fa_list_airports',
    {
      description: 'List airports known to AeroAPI (paged). Use the cursor to page through.',
      annotations: { readOnlyHint: true, openWorldHint: true },
      inputSchema: { ...pageParams },
    },
    async ({ max_pages, cursor }) => {
      const data = await client.get(`/airports${qs({ max_pages, cursor })}`);
      return textResult(data);
    },
  );

  server.registerTool(
    'fa_get_nearby_airports',
    {
      description: 'Find airports near a latitude/longitude within a radius (statute miles).',
      annotations: { readOnlyHint: true, openWorldHint: true },
      inputSchema: {
        latitude: z.number().min(-90).max(90).describe('Latitude in decimal degrees'),
        longitude: z.number().min(-180).max(180).describe('Longitude in decimal degrees'),
        radius: z.number().int().min(1).describe('Search radius in statute miles'),
        only_iap: z.boolean().optional().describe('Only airports with a published instrument approach'),
        ...pageParams,
      },
    },
    async ({ latitude, longitude, radius, only_iap, max_pages, cursor }) => {
      const data = await client.get(`/airports/nearby${qs({ latitude, longitude, radius, only_iap, max_pages, cursor })}`);
      return textResult(data);
    },
  );

  server.registerTool(
    'fa_get_airport_delays',
    {
      description: 'Get current airport delays — all delayed airports, or just one when `id` is given.',
      annotations: { readOnlyHint: true, openWorldHint: true },
      inputSchema: {
        id: AirportCode.optional().describe('Airport code to scope to a single airport (omit for all delays)'),
        ...pageParams,
      },
    },
    async ({ id, max_pages, cursor }) => {
      const path = id ? `/airports/${id}/delays` : '/airports/delays';
      const data = await client.get(`${path}${qs({ max_pages, cursor })}`);
      return textResult(data);
    },
  );

  server.registerTool(
    'fa_get_airport_weather',
    {
      description: 'Get weather for an airport: current METAR observations, or the TAF forecast.',
      annotations: { readOnlyHint: true, openWorldHint: true },
      inputSchema: {
        id: AirportCode.describe('Airport code (ICAO/IATA/LID)'),
        report: z.enum(['observations', 'forecast']).default('observations').describe('observations (METAR) or forecast (TAF)'),
        ...pageParams,
      },
    },
    async ({ id, report, max_pages, cursor }) => {
      const data = await client.get(`/airports/${id}/weather/${report}${qs({ max_pages, cursor })}`);
      return textResult(data);
    },
  );
}
