import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { textResult, McpToolError } from '@chrischall/mcp-utils';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { client } from '../client.js';
import { FlightIdent, pageParams, dateWindowParams, qs, resolveOutputDir, writePng } from './shared.js';

export function registerFlightTools(server: McpServer): void {
  server.registerTool(
    'fa_get_flights',
    {
      description:
        'Get flights for an ident — a flight designator (e.g. UAL123, AAL100), aircraft registration (e.g. N12345), or fa_flight_id. Returns recent, current, and scheduled flights for that ident.',
      annotations: { readOnlyHint: true, openWorldHint: true },
      inputSchema: {
        ident: FlightIdent.describe('Flight designator, registration, or fa_flight_id'),
        ident_type: z.enum(['designator', 'registration', 'fa_flight_id']).optional().describe('Disambiguate how `ident` is interpreted'),
        ...dateWindowParams,
        ...pageParams,
      },
    },
    async ({ ident, ident_type, start, end, max_pages, cursor }) => {
      const data = await client.get(`/flights/${ident}${qs({ ident_type, start, end, max_pages, cursor })}`);
      return textResult(data);
    },
  );

  server.registerTool(
    'fa_search_flights',
    {
      description:
        'Search airborne flights using AeroAPI\'s simplified query syntax — a single string of "-key value" pairs. Keys: -prefix -type -idents -identOrReg -airline -destination -origin -originOrDestination -aboveAltitude -belowAltitude -aboveGroundspeed -belowGroundspeed -latlong "MINLAT MINLON MAXLAT MAXLON" -filter {ga|airline}. Example: -airline UAL -belowAltitude 30000',
      annotations: { readOnlyHint: true, openWorldHint: true },
      inputSchema: {
        query: z.string().min(1).describe('Simplified "-key value" search string (max 1000 bytes)'),
        ...pageParams,
      },
    },
    async ({ query, max_pages, cursor }) => {
      const data = await client.get(`/flights/search${qs({ query, max_pages, cursor })}`);
      return textResult(data);
    },
  );

  server.registerTool(
    'fa_search_flights_advanced',
    {
      description:
        'Search flights using AeroAPI\'s full structured query language (more expressive than fa_search_flights). The `query` is a space-separated list of {operator key value} predicates, e.g. "{match ident UAL*} {> alt 300} {= dest KLAX}". ' +
        'Operators: true/false/null/notnull/=/!=/</>/<=/>=, match/notmatch (case-insensitive wildcards), range (two values), in/orig_or_dest/aircraftType/ident/ident_or_reg ({a b c} value lists), airline (1=airline, 0=GA). ' +
        'Common keys: ident, orig, dest (ICAO codes), aircraftType, alt (hundreds of ft), prefix, lifeguard, cancelled, arrived.',
      annotations: { readOnlyHint: true, openWorldHint: true },
      inputSchema: {
        query: z.string().min(1).describe('Structured "{operator key value}" query, e.g. {match ident UAL*} {> alt 300}'),
        ...pageParams,
      },
    },
    async ({ query, max_pages, cursor }) => {
      const data = await client.get(`/flights/search/advanced${qs({ query, max_pages, cursor })}`);
      return textResult(data);
    },
  );

  server.registerTool(
    'fa_get_flight_track',
    {
      description: 'Get the position track (breadcrumb log) for a specific flight by fa_flight_id.',
      annotations: { readOnlyHint: true, openWorldHint: true },
      inputSchema: {
        id: FlightIdent.describe('fa_flight_id of the flight'),
        include_estimated_positions: z.boolean().optional().describe('Include estimated positions where actual data is missing'),
      },
    },
    async ({ id, include_estimated_positions }) => {
      const data = await client.get(`/flights/${id}/track${qs({ include_estimated_positions })}`);
      return textResult(data);
    },
  );

  server.registerTool(
    'fa_get_flight_position',
    {
      description: 'Get the most recent reported position for an in-air flight by fa_flight_id.',
      annotations: { readOnlyHint: true, openWorldHint: true },
      inputSchema: {
        id: FlightIdent.describe('fa_flight_id of the flight'),
      },
    },
    async ({ id }) => {
      const data = await client.get(`/flights/${id}/position`);
      return textResult(data);
    },
  );

  server.registerTool(
    'fa_get_flight_route',
    {
      description: 'Get the decoded route (fixes/waypoints) for a specific flight by fa_flight_id.',
      annotations: { readOnlyHint: true, openWorldHint: true },
      inputSchema: {
        id: FlightIdent.describe('fa_flight_id of the flight'),
      },
    },
    async ({ id }) => {
      const data = await client.get(`/flights/${id}/route`);
      return textResult(data);
    },
  );

  server.registerTool(
    'fa_get_flight_map',
    {
      description:
        'Get a rendered map image (PNG) of a flight by fa_flight_id. Writes the PNG to disk (default: $AEROAPI_OUTPUT_DIR or cwd) and returns the path, or returns it inline as base64 when inline:true.',
      annotations: { readOnlyHint: true, openWorldHint: true },
      inputSchema: {
        id: FlightIdent.describe('fa_flight_id of the flight'),
        height: z.number().int().min(1).optional().describe('Image height in pixels'),
        width: z.number().int().min(1).optional().describe('Image width in pixels'),
        show_data_block: z.boolean().optional().describe('Overlay the flight data block on the map'),
        output_dir: z.string().optional().describe('Directory to write the PNG to (default: $AEROAPI_OUTPUT_DIR or cwd)'),
        inline: z.boolean().optional().describe('Return the PNG inline as base64 instead of writing to disk'),
      },
    },
    async ({ id, height, width, show_data_block, output_dir, inline }): Promise<CallToolResult> => {
      const data = await client.get<{ map?: string }>(`/flights/${id}/map${qs({ height, width, show_data_block })}`);
      const base64 = data.map;
      if (!base64) {
        throw new McpToolError('AeroAPI returned no map image for this flight', {
          hint: 'The fa_flight_id may be invalid or have no positions yet.',
        });
      }
      if (inline) {
        return { content: [{ type: 'image', data: base64, mimeType: 'image/png' }] };
      }
      const dir = resolveOutputDir(output_dir);
      const path = writePng(dir, `flight-map-${id}`, base64);
      return textResult({ map: path });
    },
  );

  server.registerTool(
    'fa_get_flight_history',
    {
      description:
        'Get historical flights for an ident (designator, registration, or fa_flight_id) beyond the recent window covered by fa_get_flights. NOTE: historical data requires a Standard or Premium AeroAPI tier — the free Personal tier returns 401.',
      annotations: { readOnlyHint: true, openWorldHint: true },
      inputSchema: {
        ident: FlightIdent.describe('Flight designator, registration, or fa_flight_id'),
        ident_type: z.enum(['designator', 'registration', 'fa_flight_id']).optional().describe('Disambiguate how `ident` is interpreted'),
        ...dateWindowParams,
        ...pageParams,
      },
    },
    async ({ ident, ident_type, start, end, max_pages, cursor }) => {
      const data = await client.get(`/history/flights/${ident}${qs({ ident_type, start, end, max_pages, cursor })}`);
      return textResult(data);
    },
  );
}
