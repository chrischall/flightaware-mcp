import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { isAbsolute, join, resolve } from 'node:path';
import { z } from 'zod';
import { buildQueryString, readEnvVar, expandPath } from '@chrischall/mcp-utils';

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
  .regex(/^[A-Za-z0-9.-]+$/, 'must be a flight ident, registration, or fa_flight_id (letters, digits, ".", "-")');

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
  max_pages: z.number().int().min(1).optional().describe('Max pages to fetch (AeroAPI default: 1)'),
  cursor: z.string().optional().describe('Opaque paging cursor from a previous response\'s links.next'),
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

/** Resolve the directory map PNGs are written to: arg → $AEROAPI_OUTPUT_DIR → cwd. */
export function resolveOutputDir(dir?: string): string {
  const chosen = dir ?? readEnvVar('AEROAPI_OUTPUT_DIR') ?? process.cwd();
  const abs = isAbsolute(chosen) ? chosen : resolve(process.cwd(), expandPath(chosen));
  if (!existsSync(abs)) mkdirSync(abs, { recursive: true });
  return abs;
}

/** Write a base64 PNG to `dir` under a non-overwriting filename; return the path. */
export function writePng(dir: string, base: string, base64: string): string {
  let name = `${base}.png`;
  let n = 1;
  while (existsSync(join(dir, name))) name = `${base}-${n++}.png`;
  const path = join(dir, name);
  writeFileSync(path, Buffer.from(base64, 'base64'));
  return path;
}
