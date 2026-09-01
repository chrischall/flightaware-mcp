import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { readEnvVar } from '@chrischall/mcp-utils';
import { registerCredentialHealthcheckTool } from '@chrischall/mcp-utils/healthcheck';
import { client as defaultClient, type FlightAwareClient } from '../client.js';

/**
 * `fa_healthcheck` — the one call that answers "is this connector working?",
 * and the only tool here that reports a failure as DATA rather than throwing.
 *
 * Two things shape the probe, both specific to AeroAPI:
 *
 *  - **It is billed per query.** A healthcheck that costs real money every
 *    time someone asks "is this up?" would not get used. The probe is a
 *    single static-cached airport lookup — AeroAPI's cheapest request class,
 *    and cached, so repeat checks are usually free.
 *  - **Tier, not validity, explains some 401s.** `/airports/{id}/canonical`
 *    returns 401 on the free Personal tier with a perfectly valid key. Using
 *    it as the probe would report a working key as rejected, so the probe is
 *    the plain `/airports/{id}` read, which every tier can make.
 */

type ReadEnv = (key: string) => string | undefined;

/** A large, permanently-existing airport: never 404s, and cheap to look up. */
const PROBE_AIRPORT = 'KJFK';

export function classifyFlightAwareError(err: unknown): { kind: string; hint?: string } | undefined {
  const msg = err instanceof Error ? err.message : String(err);

  if (msg.includes('Rate limited')) {
    return {
      kind: 'rate_limited',
      hint: 'AeroAPI rate-limited the probe. The key is fine — retry in a moment.',
    };
  }
  if (/401|unauthorized|forbidden|403/i.test(msg)) {
    return {
      kind: 'credential_rejected',
      hint:
        'AeroAPI rejected the key. Check AEROAPI_API_KEY at https://flightaware.com/aeroapi/portal/ — ' +
        'and note that some endpoints require a Standard or Premium tier, so a valid Personal-tier key ' +
        'can still be refused for those (this probe uses one every tier can make).',
    };
  }
  return undefined;
}

export function registerHealthcheckTools(
  server: McpServer,
  /**
   * Defaults to the module singleton every other tool module imports.
   * index.ts registers tool modules as `(server) => void` and passes no
   * client, so a required parameter here is `undefined` in production while
   * tests that inject a mock still pass.
   */
  client: Pick<FlightAwareClient, 'get'> = defaultClient,
  /** Seam: injectable so tests need no process env. */
  readEnv: ReadEnv = (k) => readEnvVar(k),
): void {
  registerCredentialHealthcheckTool({
    server,
    prefix: 'fa',
    hostLabel: 'aeroapi.flightaware.com',
    probePath: `/airports/${PROBE_AIRPORT}`,
    resolveCredential: async () => ({ source: readEnv('AEROAPI_API_KEY') ? 'AEROAPI_API_KEY' : null }),
    // `cache: 'static'` is the point: airport metadata does not change, so
    // repeat healthchecks are served from cache rather than re-billed.
    probeFn: () => client.get(`/airports/${PROBE_AIRPORT}`, { cache: 'static' }),
    classifyThrown: classifyFlightAwareError,
  });
}
