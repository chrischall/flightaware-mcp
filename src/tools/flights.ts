import { homedir } from 'node:os';
import { join } from 'node:path';
import { z } from 'zod';
import type { McpServer, CallToolResult } from '@modelcontextprotocol/server';
import { McpToolError, minifiedResult, readEnvVar, resolveOutputDir, writeBinaryOutput } from '@chrischall/mcp-utils';
import { deliverFile, INLINE_DELIVERY_MAX_BYTES, isHostedEnv, type DeliveredFile } from '@chrischall/mcp-utils/export';
import { viewArg, viewResponse } from '../view.js';
import { client } from '../client.js';
import {
  FlightIdent,
  pageParams,
  dateWindowParams,
  qs,
} from './shared.js';
import { FLIGHT_ALIASES, travelMeta } from './hints.js';

/**
 * Shape a delivered flight map as a tool result. Inline: the image block (plus
 * a note block when the route differs from the one asked for). Link: `{ via, url,
 * expiresAt }` — a signed URL, so it is handed to the user, not fetched.
 */
function deliveredResult(d: DeliveredFile): CallToolResult {
  const note = d.note ? { note: d.note } : {};
  if (d.via === 'link') return minifiedResult({ via: 'link', url: d.url, expiresAt: d.expiresAt, ...note });
  return { content: [...d.content, ...(d.note ? [{ type: 'text' as const, text: d.note }] : [])] };
}

export function registerFlightTools(server: McpServer): void {
  server.registerTool(
    'fa_get_flights',
    {
      description:
        'Get flights for an ident — a flight designator (e.g. UAL123, AAL100), aircraft registration (e.g. N12345), or fa_flight_id. Returns recent, current, and scheduled flights for that ident.',
      annotations: { readOnlyHint: true, openWorldHint: true },
      _meta: travelMeta('lookup', { aliases: FLIGHT_ALIASES }),
      inputSchema: z.object({
        view: viewArg(),
        ident: FlightIdent.describe('Flight designator, registration, or fa_flight_id'),
        ident_type: z
          .enum(['designator', 'registration', 'fa_flight_id'])
          .optional()
          .describe('Disambiguate how `ident` is interpreted'),
        ...dateWindowParams,
        ...pageParams,
      }),
    },
    async ({ ident, ident_type, start, end, max_pages, cursor, view }) => {
      const data = await client.get(
        `/flights/${ident}${qs({ ident_type, start, end, max_pages, cursor })}`,
      );
      return viewResponse(view, data);
    },
  );

  server.registerTool(
    'fa_search_flights',
    {
      description:
        'Search airborne flights using AeroAPI\'s simplified query syntax — a single string of "-key value" pairs. Keys: -prefix -type -idents -identOrReg -airline -destination -origin -originOrDestination -aboveAltitude -belowAltitude -aboveGroundspeed -belowGroundspeed -latlong "MINLAT MINLON MAXLAT MAXLON" -filter {ga|airline}. Example: -airline UAL -belowAltitude 30000',
      annotations: { readOnlyHint: true, openWorldHint: true },
      _meta: travelMeta('lookup', { aliases: ['flights', 'find a flight', 'flights between'] }),
      inputSchema: z.object({
        view: viewArg(),
        query: z.string().min(1).describe('Simplified "-key value" search string (max 1000 bytes)'),
        ...pageParams,
      }),
    },
    async ({ query, max_pages, cursor, view }) => {
      const data = await client.get(`/flights/search${qs({ query, max_pages, cursor })}`);
      return viewResponse(view, data);
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
      _meta: travelMeta('lookup', { aliases: ['flights', 'find a flight'] }),
      inputSchema: z.object({
        view: viewArg(),
        query: z
          .string()
          .min(1)
          .describe('Structured "{operator key value}" query, e.g. {match ident UAL*} {> alt 300}'),
        ...pageParams,
      }),
    },
    async ({ query, max_pages, cursor, view }) => {
      const data = await client.get(`/flights/search/advanced${qs({ query, max_pages, cursor })}`);
      return viewResponse(view, data);
    },
  );

  server.registerTool(
    'fa_get_flight_track',
    {
      description: 'Get the position track (breadcrumb log) for a specific flight by fa_flight_id.',
      annotations: { readOnlyHint: true, openWorldHint: true },
      _meta: travelMeta('lookup', { aliases: ['flight path', 'where is the plane', 'track'] }),
      inputSchema: z.object({
        view: viewArg(),
        id: FlightIdent.describe('fa_flight_id of the flight'),
        include_estimated_positions: z
          .boolean()
          .optional()
          .describe('Include estimated positions where actual data is missing'),
      }),
    },
    async ({ id, include_estimated_positions, view }) => {
      const data = await client.get(`/flights/${id}/track${qs({ include_estimated_positions })}`);
      return viewResponse(view, data);
    },
  );

  server.registerTool(
    'fa_get_flight_position',
    {
      description: 'Get the most recent reported position for an in-air flight by fa_flight_id.',
      annotations: { readOnlyHint: true, openWorldHint: true },
      _meta: travelMeta('lookup', { aliases: ['where is the plane', 'where is my flight', 'position'] }),
      inputSchema: z.object({
        view: viewArg(),
        id: FlightIdent.describe('fa_flight_id of the flight'),
      }),
    },
    async ({ id, view }) => {
      const data = await client.get(`/flights/${id}/position`);
      return viewResponse(view, data);
    },
  );

  server.registerTool(
    'fa_get_flight_route',
    {
      description: 'Get the decoded route (fixes/waypoints) for a specific flight by fa_flight_id.',
      annotations: { readOnlyHint: true, openWorldHint: true },
      _meta: travelMeta('lookup', { aliases: ['flight route', 'flight plan'] }),
      inputSchema: z.object({
        view: viewArg(),
        id: FlightIdent.describe('fa_flight_id of the flight'),
      }),
    },
    async ({ id, view }) => {
      const data = await client.get(`/flights/${id}/route`);
      return viewResponse(view, data);
    },
  );

  server.registerTool(
    'fa_get_flight_map',
    {
      description:
        'Get a rendered map image (PNG) of a flight by fa_flight_id. On a local install it writes the PNG to disk (default: $AEROAPI_OUTPUT_DIR, else ~/Downloads/flightaware-mcp) and returns the path, or returns the image inline when inline:true (up to 10 MiB; a bigger map is saved to disk, with a note). On a hosted server it returns the image inline when it fits, otherwise a signed, expiring download link (url, expiresAt) — never a path on the server\'s disk.',
      // Not read-only: the local default creates directories and writes a PNG file.
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
      _meta: travelMeta('lookup', { aliases: ['flight map', 'map'] }),
      inputSchema: z.object({
        id: FlightIdent.describe('fa_flight_id of the flight'),
        height: z.number().int().min(1).optional().describe('Image height in pixels'),
        width: z.number().int().min(1).optional().describe('Image width in pixels'),
        show_data_block: z
          .boolean()
          .optional()
          .describe('Overlay the flight data block on the map'),
        output_dir: z
          .string()
          .optional()
          .describe('Local install only: directory to write the PNG to (default: $AEROAPI_OUTPUT_DIR, else ~/Downloads/flightaware-mcp). Must be inside that default directory. On a hosted server a download link is returned instead.'),
        inline: z
          .boolean()
          .optional()
          .describe('Return the PNG inline as an image instead of writing to disk (capped at 10 MiB). Hosted: inline is already the default; inline:false returns a download link.'),
      }),
    },
    async ({ id, height, width, show_data_block, output_dir, inline }): Promise<CallToolResult> => {
      const data = await client.get<{ map?: string }>(
        `/flights/${id}/map${qs({ height, width, show_data_block })}`,
      );
      const base64 = data.map;
      if (!base64) {
        throw new McpToolError('AeroAPI returned no map image for this flight', {
          hint: 'The fa_flight_id may be invalid or have no positions yet.',
        });
      }
      const bytes = Buffer.from(base64, 'base64');
      const fileName = `flight-map-${id}.png`;
      // Hosted (mcp-host): the caller shares no filesystem with this process,
      // so a path on the runner's disk reaches nobody. The map comes back as
      // an inline image when it fits the inline cap, otherwise as a signed,
      // expiring link from the blob store; a hosted deployment with no store
      // refuses an over-cap map (too_large) rather than writing it to disk.
      // inline:false / output_dir there become a link (deliverFile notes why).
      if (isHostedEnv()) {
        const wantsSaved = inline === false || output_dir !== undefined;
        const delivered = await deliverFile({
          bytes, fileName, mimeType: 'image/png', keyPrefix: 'maps',
          prefer: inline === true ? 'inline' : wantsSaved ? 'disk' : 'auto',
        });
        return deliveredResult(delivered);
      }
      // Local install — default unchanged: write to disk and return the path.
      // arg → $AEROAPI_OUTPUT_DIR → ~/Downloads/flightaware-mcp; the write is an exclusive, no-follow
      // create under a sanitized, never-overwriting name (flight-map-X-2.png …).
      // output_dir is model-chosen, so a per-call directory must always stay
      // inside the directory the default write would use (checked through
      // symlinks): $AEROAPI_OUTPUT_DIR when the operator set it, otherwise
      // ~/Downloads/flightaware-mcp. The last-resort default is NOT cwd:
      // desktop hosts (Claude Desktop / .mcpb) spawn the server with cwd "/",
      // where the write fails (EROFS/EACCES) after the billed map query has
      // already been paid. inline:true returns the image, but only up to the
      // inline cap — a bigger map is saved to disk instead, with a note.
      const outputRoot = readEnvVar('AEROAPI_OUTPUT_DIR') || join(homedir(), 'Downloads', 'flightaware-mcp');
      const dir = resolveOutputDir(output_dir, 'AEROAPI_OUTPUT_DIR', {
        name: 'flightaware-mcp',
        allowedRoots: [outputRoot],
      });
      const tooBig = bytes.length > INLINE_DELIVERY_MAX_BYTES;
      if (inline && !tooBig) {
        return deliveredResult(await deliverFile({ bytes, fileName, mimeType: 'image/png', store: null, prefer: 'inline' }));
      }
      const path = writeBinaryOutput({ dir, baseName: `flight-map-${id}`, base64, mimeType: 'image/png' });
      return minifiedResult({
        map: path,
        ...(inline
          ? { note: `${fileName} is ${bytes.length} bytes, too large to return inline (limit ${INLINE_DELIVERY_MAX_BYTES}). It was saved to disk instead.` }
          : {}),
      });
    },
  );

  server.registerTool(
    'fa_get_flight_history',
    {
      description:
        'Get historical flights for an ident (designator, registration, or fa_flight_id) beyond the recent window covered by fa_get_flights. NOTE: historical data requires a Standard or Premium AeroAPI tier — the free Personal tier returns 401.',
      annotations: { readOnlyHint: true, openWorldHint: true },
      _meta: travelMeta('lookup', { aliases: ['past flights', 'flight history'] }),
      inputSchema: z.object({
        view: viewArg(),
        ident: FlightIdent.describe('Flight designator, registration, or fa_flight_id'),
        ident_type: z
          .enum(['designator', 'registration', 'fa_flight_id'])
          .optional()
          .describe('Disambiguate how `ident` is interpreted'),
        ...dateWindowParams,
        ...pageParams,
      }),
    },
    async ({ ident, ident_type, start, end, max_pages, cursor, view }) => {
      const data = await client.get(
        `/history/flights/${ident}${qs({ ident_type, start, end, max_pages, cursor })}`,
      );
      return viewResponse(view, data);
    },
  );

  server.registerTool(
    'fa_search_flight_positions',
    {
      description:
        'Search live flight POSITIONS using the structured "{operator key value}" query language (same grammar as fa_search_flights_advanced — NOT the simplified "-key value" syntax). Returns position points rather than flight summaries. Example: {match ident UAL*} {> alt 300}.',
      annotations: { readOnlyHint: true, openWorldHint: true },
      _meta: travelMeta('lookup', { aliases: ['planes nearby', 'planes overhead'] }),
      inputSchema: z.object({
        view: viewArg(),
        query: z
          .string()
          .min(1)
          .describe('Structured "{operator key value}" query, e.g. {match ident UAL*} {> alt 300}'),
        ...pageParams,
      }),
    },
    async ({ query, max_pages, cursor, view }) => {
      const data = await client.get(`/flights/search/positions${qs({ query, max_pages, cursor })}`);
      return viewResponse(view, data);
    },
  );

  server.registerTool(
    'fa_count_flights',
    {
      description:
        'Count flights matching a query without returning the flights themselves. Returns { count }. Uses the SIMPLIFIED "-key value" syntax (same as fa_search_flights, NOT the structured grammar of fa_search_flights_advanced). Example: -airline UAL -belowAltitude 30000.',
      annotations: { readOnlyHint: true, openWorldHint: true },
      _meta: travelMeta('lookup', { aliases: ['how many flights'] }),
      inputSchema: z.object({
        view: viewArg(),
        query: z
          .string()
          .min(1)
          .describe(
            'Simplified "-key value" search string (same syntax as fa_search_flights), e.g. -airline UAL',
          ),
      }),
    },
    async ({ query, view }) => {
      const data = await client.get(`/flights/search/count${qs({ query })}`);
      return viewResponse(view, data);
    },
  );

  server.registerTool(
    'fa_resolve_flight',
    {
      description:
        'Resolve a flight ident (designator/registration) to its canonical form and any alternate idents. NOTE: requires a Standard or Premium AeroAPI tier — the free Personal tier returns 401.',
      annotations: { readOnlyHint: true, openWorldHint: true },
      _meta: travelMeta('lookup', { aliases: FLIGHT_ALIASES }),
      inputSchema: z.object({
        view: viewArg(),
        ident: FlightIdent.describe('Flight designator or registration to canonicalize'),
        ident_type: z
          .enum(['designator', 'registration', 'fa_flight_id'])
          .optional()
          .describe('Disambiguate how `ident` is interpreted'),
      }),
    },
    async ({ ident, ident_type, view }) => {
      const data = await client.get(`/flights/${ident}/canonical${qs({ ident_type })}`, {
        cache: 'static',
      });
      return viewResponse(view, data);
    },
  );
}
