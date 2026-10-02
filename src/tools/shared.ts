import { z } from 'zod';
import { buildQueryString } from '@chrischall/mcp-utils';

/**
 * Flight ident / id (designator like `UAL123`, registration `N12345`, or an
 * `fa_flight_id` like `UAL123-1700000000-airline-0123`). Interpolated into the
 * URL path, so the charset is restricted to what real idents use — letters,
 * digits, `.` and `-` — which by construction can't escape the path segment
 * (no `/ .. ? #` or whitespace).
 */
export const FlightIdent = z
  .string()
  .min(1)
  .regex(
    /^[A-Za-z0-9.-]+$/,
    'must be a flight ident, registration, or fa_flight_id (letters, digits, ".", "-")',
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
    .describe("Opaque paging cursor from a previous response's links.next"),
};

/** Date window shared by flight/board/history calls (ISO-8601 timestamps). */
export const dateWindowParams = {
  start: z.string().optional().describe('ISO-8601 start of the time window'),
  end: z.string().optional().describe('ISO-8601 end of the time window'),
};

/**
 * Build a `?a=b&c=d` query string, dropping undefined values. Thin wrapper over
 * the shared helper so every tool serializes params identically.
 */
export function qs(params: Record<string, unknown>): string {
  return buildQueryString(params);
}
