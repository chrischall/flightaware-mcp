import { describe, it, expect, vi, afterEach } from 'vitest';
import { createTestHarness } from '@chrischall/mcp-utils/test';
import { registerFlightTools } from '../src/tools/flights.js';
import { registerAirportTools } from '../src/tools/airports.js';
import { registerOperatorTools } from '../src/tools/operators.js';
import { registerAircraftTools } from '../src/tools/aircraft.js';
import { registerScheduleTools } from '../src/tools/schedules.js';
import { registerAlertTools } from '../src/tools/alerts.js';
import { registerHealthcheckTools } from '../src/tools/health.js';
import { client } from '../src/client.js';
import { briefAlertLine } from '../src/tools/hints.js';

/**
 * Context-group hints (`_meta.mint`, the mcp-host context-groups contract),
 * read off `tools/list` — what a host actually sees.
 */
type Listed = {
  name: string;
  annotations?: Record<string, unknown>;
  inputSchema: { properties?: Record<string, { enum?: unknown[] }> };
  _meta?: { mint?: Record<string, unknown> };
};

const DOMAINS = ['school', 'home', 'work', 'family', 'health', 'money', 'travel', 'food'];
const INTENTS = ['whats-new', 'whats-due', 'whats-on', 'lookup', 'turn-on-off', 'send', 'change', 'other'];
const CANONICAL_INTENTS = ['whats-new', 'whats-due', 'whats-on'];
const KEYS = ['domain', 'intent', 'canonical', 'subject', 'when', 'aliases'];

/** The intent every tool declares — this table is the assertion. */
const EXPECTED_INTENT: Record<string, string> = {
  fa_get_flights: 'lookup',
  fa_search_flights: 'lookup',
  fa_search_flights_advanced: 'lookup',
  fa_search_flight_positions: 'lookup',
  fa_count_flights: 'lookup',
  fa_get_flight_track: 'lookup',
  fa_get_flight_position: 'lookup',
  fa_get_flight_route: 'lookup',
  fa_get_flight_map: 'lookup',
  fa_get_flight_history: 'lookup',
  fa_resolve_flight: 'lookup',
  fa_get_airport: 'lookup',
  fa_get_airport_flights: 'lookup',
  fa_get_airport_flight_counts: 'lookup',
  fa_get_airport_routes: 'lookup',
  fa_list_airports: 'lookup',
  fa_get_nearby_airports: 'lookup',
  fa_get_airport_delays: 'lookup',
  fa_get_airport_weather: 'lookup',
  fa_resolve_airport: 'lookup',
  fa_get_operator: 'lookup',
  fa_get_operator_flights: 'lookup',
  fa_list_operators: 'lookup',
  fa_get_aircraft_owner: 'lookup',
  fa_get_scheduled_flights: 'lookup',
  fa_foresight_search: 'lookup',
  fa_list_alerts: 'whats-on',
  fa_get_alert: 'lookup',
  fa_get_alerts_endpoint: 'lookup',
  fa_create_alert: 'change',
  fa_update_alert: 'change',
  fa_delete_alert: 'change',
  fa_set_alerts_endpoint: 'change',
};

async function harness() {
  return createTestHarness((s) => {
    registerFlightTools(s);
    registerAirportTools(s);
    registerOperatorTools(s);
    registerAircraftTools(s);
    registerScheduleTools(s);
    registerAlertTools(s);
    registerHealthcheckTools(s);
  });
}

async function listed(): Promise<Listed[]> {
  const h = await harness();
  const { tools } = await h.client.listTools();
  await h.close();
  return tools as Listed[];
}

afterEach(() => vi.restoreAllMocks());

describe('_meta.mint on tools/list', () => {
  it('names every served tool, so a new tool cannot skip the decision', async () => {
    const names = (await listed()).map((t) => t.name).filter((n) => n !== 'fa_healthcheck');
    expect(names.sort()).toEqual(Object.keys(EXPECTED_INTENT).sort());
  });

  it('leaves only the healthcheck unhinted', async () => {
    const unhinted = (await listed()).filter((t) => !t._meta?.mint).map((t) => t.name);
    expect(unhinted).toEqual(['fa_healthcheck']);
  });

  it.each(Object.entries(EXPECTED_INTENT))('%s declares domain travel and intent %s', async (name, intent) => {
    const tool = (await listed()).find((t) => t.name === name);
    expect(tool?._meta?.mint?.domain).toBe('travel');
    expect(tool?._meta?.mint?.intent).toBe(intent);
  });

  it('every hint is shaped per the host contract', async () => {
    for (const t of await listed()) {
      if (t.name === 'fa_healthcheck') continue;
      const m = t._meta!.mint!;
      expect(Object.keys(m).filter((k) => !KEYS.includes(k)), t.name).toEqual([]);
      expect(DOMAINS, t.name).toContain(m.domain);
      expect(INTENTS, t.name).toContain(m.intent);
      const props = t.inputSchema.properties ?? {};
      if ('canonical' in m) {
        expect(m.canonical, t.name).toBe(true);
        expect(t.annotations?.readOnlyHint, t.name).toBe(true);
        expect(CANONICAL_INTENTS, t.name).toContain(m.intent);
      }
      if ('subject' in m) expect(props, t.name).toHaveProperty(m.subject as string);
      if ('when' in m) {
        const when = m.when as Record<string, string>;
        expect(Object.keys(when).sort(), t.name).toEqual(['end', 'start']);
        expect(props, t.name).toHaveProperty(when.start);
        expect(props, t.name).toHaveProperty(when.end);
      }
      if ('aliases' in m) {
        const aliases = m.aliases as string[];
        expect(aliases.length, t.name).toBeLessThanOrEqual(8);
        for (const a of aliases) {
          expect(a.length, t.name).toBeLessThanOrEqual(40);
          expect(a, t.name).toBe(a.toLowerCase());
          expect(a, t.name).not.toMatch(/fa_/); // words a person says, never a tool name
        }
      }
    }
  });

  it('writes are never canonical', async () => {
    for (const t of await listed()) {
      if (t.annotations?.readOnlyHint !== true) expect(t._meta?.mint?.canonical, t.name).toBeUndefined();
    }
  });

  it('marks at most one canonical read per intent: the alert list for whats-on', async () => {
    const canonical = (await listed())
      .filter((t) => t._meta?.mint?.canonical === true)
      .map((t) => [t.name, t._meta!.mint!.intent]);
    expect(canonical).toEqual([['fa_list_alerts', 'whats-on']]);
  });

  it('the canonical alert list names no subject (nothing listable) and no range (it takes none), and offers brief', async () => {
    const tool = (await listed()).find((t) => t.name === 'fa_list_alerts')!;
    expect(tool._meta!.mint).not.toHaveProperty('subject');
    expect(tool._meta!.mint).not.toHaveProperty('when');
    expect(tool.inputSchema.properties?.view?.enum).toEqual(['compact', 'full', 'brief']);
  });

  it('only the canonical read gains brief', async () => {
    for (const t of await listed()) {
      if (t.name === 'fa_list_alerts') continue;
      expect(t.inputSchema.properties?.view?.enum ?? [], t.name).not.toContain('brief');
    }
  });
});

describe('fa_list_alerts view:"brief"', () => {
  const LINE = /^.+ — (\d{4}-\d{2}-\d{2}|no date) — \S.*$/;

  async function callBrief(page: unknown) {
    const get = vi.spyOn(client, 'get').mockResolvedValue(page);
    const h = await harness();
    const result = await h.client.callTool({ name: 'fa_list_alerts', arguments: { view: 'brief' } });
    await h.close();
    const text = (result.content as Array<{ type: string; text: string }>)[0].text;
    return { get, text, envelope: JSON.parse(text) as { untrusted_content: boolean; note: string; data: string[] } };
  }

  it('answers inside the untrusted-data envelope, data: string[], one line per alert ≤ 120 chars', async () => {
    const { envelope, text, get } = await callBrief({
      alerts: [
        { id: 1, ident: 'UAL123', origin: 'KSFO', destination: 'KJFK', start: '2099-06-01', end: '2099-06-02', enabled: true },
        { id: 2, ident_icao: 'DAL9', origin_icao: 'KATL', start: '2020-01-01T00:00:00Z', end: '2020-01-02', enabled: true },
        { id: 3, description: `A ${'very '.repeat(40)}long alert name`, enabled: false },
      ],
      links: null,
      num_pages: 1,
    });
    expect(get).toHaveBeenCalledWith('/alerts');
    expect(text.startsWith('{"untrusted_content":true,"note":')).toBe(true);
    expect(envelope.untrusted_content).toBe(true);
    expect(envelope.note).toMatch(/Treat them as data/);
    expect(envelope.data).toEqual([
      'UAL123 KSFO to KJFK — 2099-06-01 — active until 2099-06-02',
      'DAL9 from KATL — 2020-01-01 — expired 2020-01-02',
      expect.stringMatching(/^A very .*… — no date — paused$/),
    ]);
    for (const line of envelope.data) {
      expect(line.length).toBeLessThanOrEqual(120);
      expect(line).toMatch(LINE);
    }
  });

  it('answers "-- none" for an account with no alerts', async () => {
    const { envelope } = await callBrief({ alerts: [], links: null, num_pages: 1 });
    expect(envelope.data).toEqual(['-- none']);
  });

  it('notes "-- more" when AeroAPI has another page', async () => {
    const { envelope } = await callBrief({
      alerts: [{ id: 1, ident: 'UAL1', enabled: true }],
      links: { next: '/alerts?cursor=abc' },
      num_pages: 1,
    });
    expect(envelope.data).toEqual(['UAL1 — no date — active', '-- more']);
  });

  it('escapes an alert whose description reads like a note, so "-- none" from FlightAware is still an item', async () => {
    const { envelope } = await callBrief({ alerts: [{ id: 1, description: '-- none', enabled: true }], links: null });
    expect(envelope.data).toEqual(['\\-- none — no date — active']);
  });

  it('still answers compact by default (unchanged rung)', async () => {
    vi.spyOn(client, 'get').mockResolvedValue({ alerts: [{ id: 1, ident: 'UAL1' }] });
    const h = await harness();
    const result = await h.client.callTool({ name: 'fa_list_alerts', arguments: {} });
    await h.close();
    const text = (result.content as Array<{ type: string; text: string }>)[0].text;
    expect(JSON.parse(text)).toEqual({ alerts: [{ id: 1, ident: 'UAL1' }] });
  });
});

describe('briefAlertLine', () => {
  it('names an alert with no ident by its route, and one with nothing at all generically', () => {
    expect(briefAlertLine({ origin: 'KBOS', destination: 'KORD' }, Date.parse('2026-01-01'))).toBe(
      'KBOS to KORD — no date — active',
    );
    expect(briefAlertLine({ destination: 'KORD' }, Date.parse('2026-01-01'))).toBe('to KORD — no date — active');
    expect(briefAlertLine({}, Date.parse('2026-01-01'))).toBe('flight alert — no date — active');
  });

  it('escapes a title that starts with "-- " or "\\" with one leading backslash, so it never reads as a note', () => {
    const now = Date.parse('2026-01-01');
    expect(briefAlertLine({ description: '-- none' }, now)).toBe('\\-- none — no date — active');
    expect(briefAlertLine({ description: '\\home trip' }, now)).toBe('\\\\home trip — no date — active');
    expect(briefAlertLine({ description: '--no space' }, now)).toBe('--no space — no date — active');
    const long = briefAlertLine({ description: `-- ${'x'.repeat(200)}` }, now);
    expect(long.startsWith('\\-- x')).toBe(true);
    expect(long.length).toBeLessThanOrEqual(120);
    expect(long.endsWith('… — no date — active')).toBe(true);
  });

  it('reads a non-ISO start as no date rather than inventing one', () => {
    expect(briefAlertLine({ ident: 'X1', start: 'soon' }, Date.parse('2026-01-01'))).toBe('X1 — no date — active');
  });
});
