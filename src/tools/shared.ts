import { z } from 'zod';
import { buildQueryString } from '@chrischall/mcp-utils';

/**
 * Flight ident / id (designator like `UAL123`, registration `N12345`, or an
 * `fa_flight_id` like `UAL123-1700000000-airline-0123`). Interpolated into the
 * URL path, so the charset is restricted to what real idents use — letters,
 * digits, `.` and `-` — and the first character must be a letter or digit.
 * That excludes `/ ? #` and whitespace, and also the dot segments `.` / `..`,
 * which fetch would otherwise normalise (`/flights/../track` → `/track`) into a
 * different AeroAPI endpoint.
 */
export const FlightIdent = z
  .string()
  .min(1)
  .regex(
    /^[A-Za-z0-9][A-Za-z0-9.-]*$/,
    'must be a flight ident, registration, or fa_flight_id (letters, digits, ".", "-"; starting with a letter or digit)',
  );

/** Airport code (ICAO `KJFK`, IATA `JFK`, or LID) — alphanumeric only. */
export const AirportCode = z
  .string()
  .min(1)
  .regex(/^[A-Za-z0-9]+$/, 'must be an airport code (ICAO/IATA/LID, alphanumeric)');

/** Operator code (ICAO `UAL` or IATA `UA`) — alphanumeric only. */
export const OperatorCode = z
  .string()
  .min(1)
  .regex(/^[A-Za-z0-9]+$/, 'must be an operator code (ICAO/IATA, alphanumeric)');

/** Alert id — a positive integer (path segment). */
export const AlertId = z.number().int().positive();

/** Pagination knobs shared by every paged AeroAPI collection. */
export const pageParams = {
  max_pages: z
    .number()
    .int()
    .min(1)
    .max(20)
    .optional()
    .describe(
      'Max pages to fetch, 1-20 (AeroAPI default: 1). Capped at 20 since AeroAPI bills per page.',
    ),
  cursor: z
    .string()
    .optional()
    .describe(
      "Paging cursor: the cursor query parameter of a previous response's links.next (passing the whole links.next value also works)",
    ),
};

/** Date window shared by flight/board/history calls (ISO-8601 timestamps). */
export const dateWindowParams = {
  start: z.string().optional().describe('ISO-8601 start of the time window'),
  end: z.string().optional().describe('ISO-8601 end of the time window'),
};

/**
 * Build a `?a=b&c=d` query string, dropping undefined values. Thin wrapper over
 * the shared helper so every tool serializes params identically; a `cursor`
 * given as a whole `links.next` value is reduced to its cursor token.
 */
export function qs(params: Record<string, unknown>): string {
  const { cursor } = params;
  if (typeof cursor === 'string') return buildQueryString({ ...params, cursor: cursorToken(cursor) });
  return buildQueryString(params);
}

/**
 * AeroAPI's `links.next` is a relative URL (`/flights/search?query=…&cursor=abc`),
 * not a bare token, and a model will often pass the whole thing. Pull the
 * `cursor` query param out of it so page 2 is actually reached instead of
 * sending `?cursor=%2Fflights%2Fsearch%3F…`. A bare token passes through.
 */
function cursorToken(value: string): string {
  const q = value.indexOf('?');
  if (q === -1) return value;
  return new URLSearchParams(value.slice(q + 1)).get('cursor') ?? value;
}
