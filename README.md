# flightaware-mcp

[![npm](https://img.shields.io/npm/v/@chrischall/flightaware-mcp)](https://www.npmjs.com/package/@chrischall/flightaware-mcp)

MCP server for **FlightAware AeroAPI** (v4) — live flight tracking and aviation data for Claude. Track flights, read airport boards, look up operators and aircraft, fetch scheduled flights, and manage flight alerts, all over stdio.

> Developed and maintained by AI (Claude Code). Use at your own discretion.

## Quick start

```json
{
  "mcpServers": {
    "flightaware": {
      "command": "npx",
      "args": ["-y", "@chrischall/flightaware-mcp"],
      "env": { "AEROAPI_API_KEY": "your-aeroapi-key-here" }
    }
  }
}
```

Get a key at [flightaware.com/aeroapi/portal](https://www.flightaware.com/aeroapi/portal/). The free **Personal** tier (500 calls/month) is enough to start; AeroAPI bills per query.

## Tools

| Area | Tools |
| --- | --- |
| Flights | `fa_get_flights`, `fa_search_flights`, `fa_search_flights_advanced`, `fa_search_flight_positions`, `fa_count_flights`, `fa_get_flight_track`, `fa_get_flight_position`, `fa_get_flight_route`, `fa_get_flight_map`, `fa_get_flight_history`, `fa_resolve_flight` |
| Airports | `fa_get_airport`, `fa_get_airport_flights`, `fa_get_airport_flight_counts`, `fa_get_airport_routes`, `fa_list_airports`, `fa_get_nearby_airports`, `fa_get_airport_delays`, `fa_get_airport_weather`, `fa_resolve_airport` |
| Operators / aircraft | `fa_get_operator`, `fa_get_operator_flights`, `fa_list_operators`, `fa_get_aircraft_owner` |
| Schedules / predictive | `fa_get_scheduled_flights`, `fa_foresight_search` (premium tier) |
| Alerts | `fa_list_alerts`, `fa_get_alert`, `fa_create_alert`, `fa_update_alert`, `fa_delete_alert`, `fa_get_alerts_endpoint`, `fa_set_alerts_endpoint` |
| Health | `fa_healthcheck` — is this connector working? Reports whether AEROAPI_API_KEY resolved, whether AeroAPI accepted it, and what to fix. Uses a static-cached lookup, so repeat checks are not re-billed. |

Alert mutations (`fa_create_alert`, `fa_update_alert`, `fa_delete_alert`, `fa_set_alerts_endpoint`) ask you to confirm before they write — see [Confirmations](#confirmations).

## Confirmations

Every alert mutation asks for your confirmation before it touches your AeroAPI account. A client that can show a confirmation prompt (Claude Code) shows one. On a client that cannot (claude.ai, Claude Desktop), the first call makes **no** network call and returns a preview of the exact request (method, path, body) plus a `confirmToken`; only a repeat call with that token sends it. A token acts once, expires, and is refused if the request changed since the preview.

| variable | default | |
|---|---|---|
| `MCP_CONFIRM_MODE` | `ask-user` | What a write does on a client that cannot show a confirmation prompt (claude.ai, Claude Desktop). `ask-user`: two steps — the first call does nothing and returns a preview plus a token, and the model must get your approval in chat before calling again with it. `auto`: the same two steps, but the model may use the token after reviewing the preview itself. `refuse`: writes are refused on such clients. A client that can show prompts (Claude Code) always gets the real prompt. An unrecognised value is treated as `refuse`. |
| `MCP_CONFIRM_TTL_SECONDS` | `600` | How long a token stays valid. |
| `MCP_CONFIRM_SECRET` | random per process | Signing key; set it only if tokens must survive a server restart. |

## Configuration

| Var | Required | Purpose |
| --- | --- | --- |
| `AEROAPI_API_KEY` | yes | Your AeroAPI key (sent as the `x-apikey` header). |
| `AEROAPI_OUTPUT_DIR` | no | Default directory for flight-map PNGs (default: cwd). |
| `AEROAPI_CACHE_TTL` | no | Seconds to cache identical **live-data** GET responses (default: 15; `0` disables). Cuts AeroAPI per-query billing. |
| `AEROAPI_STATIC_CACHE_TTL` | no | Longer TTL for **reference data** — airport/operator info, routes, ownership, canonical lookups (default: 3600; `0` disables). |

## Development

```bash
npm install
npm run build
npm test
```

Every request rides your own AeroAPI key and counts against your subscription quota. See `docs/FLIGHTAWARE-API.md` for the pinned endpoint surface.

## License

MIT
