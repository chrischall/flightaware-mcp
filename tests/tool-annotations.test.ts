import { describe, it, expect } from 'vitest';
import { createTestHarness } from '@chrischall/mcp-utils/test';
import { registerFlightTools } from '../src/tools/flights.js';
import { registerAirportTools } from '../src/tools/airports.js';
import { registerOperatorTools } from '../src/tools/operators.js';
import { registerAircraftTools } from '../src/tools/aircraft.js';
import { registerScheduleTools } from '../src/tools/schedules.js';
import { registerAlertTools } from '../src/tools/alerts.js';
import { registerHealthcheckTools } from '../src/tools/health.js';

/**
 * Fleet annotation invariants, read off the served tools/list (not a
 * hand-kept list). `destructiveHint` DEFAULTS TO TRUE whenever readOnlyHint is
 * false, so a write that forgets to declare it publishes as destructive and
 * nothing fails — a considered `false` and a forgotten one look identical.
 */
async function servedAnnotations(): Promise<Record<string, Record<string, unknown> | undefined>> {
  const h = await createTestHarness((s) => {
    registerFlightTools(s);
    registerAirportTools(s);
    registerOperatorTools(s);
    registerAircraftTools(s);
    registerScheduleTools(s);
    registerAlertTools(s);
    registerHealthcheckTools(s);
  });
  const { tools } = await h.client.listTools();
  return Object.fromEntries(tools.map((t) => [t.name, t.annotations as Record<string, unknown> | undefined]));
}

describe('tool annotations', () => {
  it('covers the full surface (a meta-test that silently drops a registrar is worse than none)', async () => {
    expect(Object.keys(await servedAnnotations())).toHaveLength(34);
  });

  it('sets an explicit boolean readOnlyHint on every tool', async () => {
    const missing = Object.entries(await servedAnnotations())
      .filter(([, a]) => typeof a?.readOnlyHint !== 'boolean')
      .map(([n]) => n);
    expect(missing).toEqual([]);
  });

  it('sets an explicit boolean destructiveHint on every write', async () => {
    const undeclared = Object.entries(await servedAnnotations())
      .filter(([, a]) => a?.readOnlyHint === false && typeof a?.destructiveHint !== 'boolean')
      .map(([n]) => n);
    expect(undeclared).toEqual([]);
  });

  it('never lets a read claim to be destructive', async () => {
    const contradictory = Object.entries(await servedAnnotations())
      .filter(([, a]) => a?.readOnlyHint === true && a?.destructiveHint === true)
      .map(([n]) => n);
    expect(contradictory).toEqual([]);
  });

  it('marks every tool open-world (each one calls AeroAPI)', async () => {
    const closed = Object.entries(await servedAnnotations())
      .filter(([, a]) => a?.openWorldHint !== true)
      .map(([n]) => n);
    expect(closed).toEqual([]);
  });

  it('holds the destructive set at its measured size', async () => {
    // update/delete/set-endpoint; growing this should be a decision, not a side effect.
    const destructive = Object.entries(await servedAnnotations())
      .filter(([, a]) => a?.readOnlyHint === false && a?.destructiveHint === true)
      .map(([n]) => n)
      .sort();
    expect(destructive).toEqual(['fa_delete_alert', 'fa_set_alerts_endpoint', 'fa_update_alert']);
  });
});
