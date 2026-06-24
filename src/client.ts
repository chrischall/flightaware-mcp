import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  loadDotenvSafely,
  readEnvVar,
  createApiClient,
  formatApiError,
  McpToolError,
  type ApiClient,
} from '@chrischall/mcp-utils';

// Load .env for local dev; silently skip if dotenv is unavailable (e.g. the
// .mcpb bundle). loadDotenvSafely never lets .env override a host-provided value.
const __dirname = dirname(fileURLToPath(import.meta.url));
await loadDotenvSafely({ path: join(__dirname, '..', '.env'), override: false });

const BASE_URL = 'https://aeroapi.flightaware.com/aeroapi';
const SERVICE = 'FlightAware AeroAPI';
// AeroAPI is billed per query and the free Personal tier is small; keep the
// default abort budget conservative. Most calls return in well under 30s.
const REQUEST_TIMEOUT_MS = 30_000;

/** Result of a mutating call: parsed body (if any) plus the new-resource id
 * AeroAPI returns in the `Location` header on create. */
export interface WriteResult<T = unknown> {
  status: number;
  /** Trailing path segment of the `Location` header (e.g. the new alert id). */
  locationId?: string;
  data?: T;
}

export class FlightAwareClient {
  private readonly apiKey: string | null;
  private readonly configError: Error | null;
  private readonly api: ApiClient;
  private readonly fetchImpl: typeof fetch;

  /**
   * Defer the config error so the server still boots (and answers the host's
   * install-time tools/list probe) when AEROAPI_API_KEY isn't set yet. The
   * error is re-raised at request time via requireKey().
   */
  constructor(opts: { fetchImpl?: typeof fetch } = {}) {
    const key = readEnvVar('AEROAPI_API_KEY');
    if (!key) {
      this.apiKey = null;
      this.configError = new McpToolError('AEROAPI_API_KEY environment variable is required', {
        hint: 'Create an AeroAPI key at https://www.flightaware.com/aeroapi/portal/ and set AEROAPI_API_KEY in your MCP host env or .env (free Personal tier is fine to start).',
      });
    } else {
      this.apiKey = key;
      this.configError = null;
    }
    this.fetchImpl = opts.fetchImpl ?? fetch;
    // AeroAPI authenticates with the `x-apikey` header (NOT Authorization:
    // Bearer), so we pass tokenHeader. getToken defers the config error to
    // request time. retry once on 429; on* handlers keep actionable messages.
    this.api = createApiClient({
      baseUrl: BASE_URL,
      serviceName: SERVICE,
      tokenHeader: 'x-apikey',
      getToken: () => this.requireKey(),
      timeout: REQUEST_TIMEOUT_MS,
      retry: { count: 1, delayMs: 1000 },
      fetchImpl: this.fetchImpl,
      // AeroAPI returns 401 for BOTH an invalid key AND a valid key hitting an
      // endpoint above its subscription tier (alerts and historical data need
      // the Standard/Premium tier — the free Personal tier 401s them with a
      // "tier" detail). onUnauthorized can't see the body, so the message names
      // both causes rather than falsely asserting the key is bad.
      onUnauthorized: () =>
        new McpToolError(
          'AeroAPI returned 401 Unauthorized — either AEROAPI_API_KEY is invalid, or this endpoint requires a higher subscription tier (Alerts and historical data need the Standard or Premium tier; the free Personal tier does not include them).',
          { hint: 'Check your key and plan at https://www.flightaware.com/aeroapi/portal/' },
        ),
      onRateLimited: () =>
        new McpToolError('Rate limited by AeroAPI', {
          hint: 'AeroAPI bills per query and rate-limits each tier — space out calls or check your usage in the portal.',
        }),
    });
  }

  private requireKey(): string {
    if (this.configError) throw this.configError;
    return this.apiKey!;
  }

  /** GET a JSON resource. `path` must already include any query string. */
  async get<T = unknown>(path: string): Promise<T> {
    return this.api.fetchJson<T>('GET', path);
  }

  /**
   * Mutating call (POST/PUT/DELETE). Routed through raw fetch (not fetchJson)
   * because AeroAPI returns the new-resource id in the `Location` header on
   * create and an empty body on delete — neither fits a JSON-only client.
   * Auth (x-apikey) is attached centrally here so no tool builds it by hand.
   */
  async write<T = unknown>(method: 'POST' | 'PUT' | 'DELETE', path: string, body?: unknown): Promise<WriteResult<T>> {
    const key = this.requireKey();
    const headers: Record<string, string> = { 'x-apikey': key };
    let payload: string | undefined;
    if (body !== undefined) {
      headers['Content-Type'] = 'application/json; charset=UTF-8';
      payload = JSON.stringify(body);
    }
    const res = await this.fetchImpl(`${BASE_URL}${path}`, { method, headers, body: payload });
    const text = await res.text();
    if (!res.ok) {
      throw new McpToolError(formatApiError(res.status, method, path, text, { service: SERVICE }));
    }
    const location = res.headers.get('location') ?? undefined;
    const locationId = location ? location.split('/').filter(Boolean).pop() : undefined;
    let data: T | undefined;
    if (text.trim()) {
      try {
        data = JSON.parse(text) as T;
      } catch {
        // Some mutations reply with a non-JSON body; surface it verbatim.
        data = text as unknown as T;
      }
    }
    return { status: res.status, locationId, data };
  }
}

/**
 * Module-level singleton shared by every tool module. Constructed here (not in
 * index.ts) so the deferred-config-error pattern holds: the server boots and
 * lists tools even without a key — the error surfaces on the first tool call.
 */
export const client = new FlightAwareClient();
