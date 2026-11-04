import { UNTRUSTED_CONTENT_RULE, untrustedEnvelope } from '@chrischall/mcp-utils';
import type { CallToolResult } from '@modelcontextprotocol/server';

/**
 * `_meta.mint` hints (the mcp-host context-groups contract): which canonical
 * group a tool belongs to, what kind of ask it answers, and the everyday words
 * its name and description lack. Inert data to any other client.
 *
 * Every FlightAware tool is in the `travel` group. AeroAPI is public flight
 * data keyed by one account, so there is no listable set of the person's
 * subjects (no children, properties or accounts) and no hint names a
 * `subject`. The one read that is about the PERSON rather than the world is
 * the account's flight alerts — the flights they are watching — so
 * `fa_list_alerts` is the canonical *what's on* read. It takes no date range,
 * so it names no `when`. Nothing here answers *what's new* or *what's due*.
 */
export type MintIntent =
  | 'whats-new' | 'whats-due' | 'whats-on' | 'lookup' | 'turn-on-off' | 'send' | 'change' | 'other';

export interface MintHint {
  domain: 'travel';
  intent: MintIntent;
  canonical?: true;
  subject?: string;
  when?: { start: string; end: string };
  /** Lowercase, at most 8, each at most 40 chars: words a person says. */
  aliases?: string[];
}

/** `_meta` for a FlightAware tool. */
export function travelMeta(
  intent: MintIntent,
  extra: Omit<MintHint, 'domain' | 'intent'> = {},
): { mint: MintHint } {
  return { mint: { domain: 'travel', intent, ...extra } };
}

/** What people say when they ask about a flight. */
export const FLIGHT_ALIASES = ['flight', 'flight status', 'plane', 'on time', 'delayed', 'landed', 'arrival', 'departure'];
/** What people say when they ask about an airport. */
export const AIRPORT_ALIASES = ['airport', 'departures', 'arrivals', 'delays', 'terminal'];
/** What people say about the flights they are watching. */
export const ALERT_ALIASES = ['flight alerts', 'my flights', 'tracked flights', 'flights i am watching', 'upcoming flights'];

/** The canonical read's rungs: the server's two, plus the context-groups one-liner. */
export const ALERT_LIST_VIEWS = ['compact', 'full', 'brief'] as const;

const BRIEF_MAX = 120;

/**
 * One alert as AeroAPI's `GET /alerts` lists it. Pinned from the v4 spec, not a
 * captured 200 (the Alerts API needs a Standard/Premium tier) — so every field
 * is optional and the ICAO/IATA spellings are read as fallbacks.
 */
export interface RawAlert {
  description?: string | null;
  ident?: string | null;
  ident_icao?: string | null;
  ident_iata?: string | null;
  origin?: string | null;
  origin_icao?: string | null;
  origin_iata?: string | null;
  destination?: string | null;
  destination_icao?: string | null;
  destination_iata?: string | null;
  start?: string | null;
  end?: string | null;
  enabled?: boolean | null;
}

const text = (...values: Array<string | null | undefined>): string | undefined => {
  for (const v of values) if (typeof v === 'string' && v.trim() !== '') return v.trim();
  return undefined;
};

/** The ISO calendar date at the head of a value, or undefined — never invented. */
const isoDate = (value: string | null | undefined): string | undefined => {
  const m = typeof value === 'string' ? /^(\d{4}-\d{2}-\d{2})/.exec(value) : null;
  return m?.[1];
};

/**
 * `title — <ISO date | no date> — <status>`, at most 120 chars. The title is
 * the watched ident and route, else the alert's description; the date is when
 * the alert becomes active; the status says whether it is active, paused or
 * past its end date. A title that starts with `-- ` or `\` is escaped with
 * one leading `\` so a description can never masquerade as a note line.
 */
export function briefAlertLine(alert: RawAlert, now: number = Date.now()): string {
  const ident = text(alert.ident, alert.ident_icao, alert.ident_iata);
  const origin = text(alert.origin, alert.origin_icao, alert.origin_iata);
  const destination = text(alert.destination, alert.destination_icao, alert.destination_iata);
  const route =
    origin && destination ? `${origin} to ${destination}` : origin ? `from ${origin}` : destination ? `to ${destination}` : undefined;
  const title =
    (ident ? [ident, route].filter(Boolean).join(' ') : undefined) ?? text(alert.description) ?? route ?? 'flight alert';
  const date = isoDate(alert.start) ?? 'no date';
  const end = isoDate(alert.end);
  const status =
    alert.enabled === false
      ? 'paused'
      : end && Date.parse(`${end}T23:59:59Z`) < now
        ? `expired ${end}`
        : end
          ? `active until ${end}`
          : 'active';
  // A title that starts with `-- ` (a note) or `\` (the escape itself) gets
  // one leading backslash, which the gateway strips from every item line.
  const escaped = title.startsWith('-- ') || title.startsWith('\\') ? `\\${title}` : title;
  // The whole line is held to 120 chars; only the title can give way, since
  // the date and status are bounded (`active until YYYY-MM-DD` at most).
  const tail = ` — ${date} — ${status}`;
  const room = BRIEF_MAX - tail.length;
  const shown = escaped.length > room ? `${escaped.slice(0, Math.max(room - 1, 0))}…` : escaped;
  return `${shown}${tail}`;
}

/**
 * The brief rung of `fa_list_alerts`: one line per alert, inside the fleet's
 * untrusted-data envelope as `data: string[]` (alert descriptions are free
 * text, and idents/routes are FlightAware's data). `-- none` for an empty
 * account; `-- more` when AeroAPI has another page, which brief never fetches
 * silently — AeroAPI gives no total, so the note cannot say "N of M".
 */
export function briefAlertsResponse(data: unknown): CallToolResult {
  const page = (data ?? {}) as { alerts?: RawAlert[] | null; links?: { next?: string | null } | null };
  const alerts = Array.isArray(page.alerts) ? page.alerts : [];
  const lines = alerts.map((a) => briefAlertLine(a ?? {}));
  if (lines.length === 0) lines.push('-- none');
  if (typeof page.links?.next === 'string' && page.links.next !== '') lines.push('-- more');
  const payload = untrustedEnvelope(lines, {
    note: `Alert descriptions, idents and routes come from FlightAware and your AeroAPI account. ${UNTRUSTED_CONTENT_RULE}`,
  });
  return { content: [{ type: 'text', text: JSON.stringify(payload) }] };
}
