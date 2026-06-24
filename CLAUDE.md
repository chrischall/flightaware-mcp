# CLAUDE.md — flightaware-mcp

Guidance for Claude working in this repo.

## TL;DR

**FlightAware AeroAPI** (v4) MCP server. Wraps the AeroAPI REST API
(`https://aeroapi.flightaware.com/aeroapi`) and exposes 33 tools to Claude over
stdio: flight lookup/search/positions/count/track/position/route/map/history/
canonical, airport boards + counts + routes + delays + weather + nearby +
canonical, operators, aircraft owner, scheduled flights, Foresight predictive
search, and flight-alert management.

Auth is an AeroAPI key (`AEROAPI_API_KEY`) sent in the **`x-apikey`** header —
AeroAPI does **not** use `Authorization: Bearer`. This is the bearer/direct-API
archetype: reads go through the fleet-shared `createApiClient` (configured with
a non-Bearer `tokenHeader`); mutations go through a small raw-`fetch` `write()`
because AeroAPI returns the new-resource id in the `Location` header on create
and an empty body on delete (neither fits a JSON-only client). No fetchproxy.

## Environment

```
AEROAPI_API_KEY=<key>     # Required. Create at https://www.flightaware.com/aeroapi/portal/
AEROAPI_OUTPUT_DIR=<dir>  # Optional. Where flight-map PNGs are written (default: cwd)
AEROAPI_CACHE_TTL=<secs>  # Optional. Read-cache TTL in seconds (default 15; 0 disables)
```

`client.get()` is backed by a short-TTL in-memory cache keyed by full path
(`AEROAPI_CACHE_TTL`, default 15s) to cut AeroAPI's per-query billing; writes
are never cached. Tier note: alerts, `fa_get_flight_history`, and the
`fa_resolve_*` canonical tools require a Standard/Premium tier (Personal 401s).

Loaded via `loadDotenvSafely` from `.env` next to `dist/` (failure swallowed —
the .mcpb bundle has no dotenv). The config error is **deferred**: the server
boots without a key and the actionable error surfaces on the first tool call,
so the host's install-time `tools/list` probe still succeeds.

## Layout

- `src/client.ts` — `FlightAwareClient` (deferred config; `get()` reads via
  `createApiClient`; `write()` raw fetch for mutations + Location parsing).
- `src/tools/shared.ts` — path-segment guards (`FlightIdent`/`AirportCode`/
  `OperatorCode`/`AlertId`), pagination/date-window schemas, `qs()`, and the
  map-PNG writer.
- `src/tools/{flights,airports,operators,aircraft,schedules,alerts}.ts` — each
  exports `register*Tools(server)`; `index.ts` wires them via `runMcp`.

## Conventions

- **Confirm-gated writes.** Every alert mutation takes `confirm` (`schemaConfirm`).
  Without `confirm: true` it makes NO network call and returns a dry-run preview;
  with it, the call routes through `client.write()`.
- **Path-injection guards.** `ident`/`id`/codes are interpolated into the URL
  path, so their zod schemas restrict the charset (see `shared.ts`).
- **Verify before trusting a shape.** Many response shapes are coded from the
  documented v4 surface and marked **[verify-pending]** in `docs/FLIGHTAWARE-API.md`
  — re-verify against a real 200 (free Personal key) before treating as confirmed.
- TDD; mock the network in tests. Don't hand-bump the version (release-please).
