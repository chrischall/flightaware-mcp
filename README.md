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
| Flights | `fa_get_flights`, `fa_search_flights`, `fa_search_flights_advanced`, `fa_get_flight_track`, `fa_get_flight_position`, `fa_get_flight_route`, `fa_get_flight_map`, `fa_get_flight_history` |
| Airports | `fa_get_airport`, `fa_get_airport_flights`, `fa_list_airports`, `fa_get_nearby_airports`, `fa_get_airport_delays`, `fa_get_airport_weather` |
| Operators / aircraft | `fa_get_operator`, `fa_get_operator_flights`, `fa_list_operators`, `fa_get_aircraft_owner` |
| Schedules / predictive | `fa_get_scheduled_flights`, `fa_foresight_search` (premium tier) |
| Alerts | `fa_list_alerts`, `fa_get_alert`, `fa_create_alert`, `fa_update_alert`, `fa_delete_alert`, `fa_get_alerts_endpoint`, `fa_set_alerts_endpoint` |

Alert mutations are **confirm-gated**: without `confirm: true` they return a dry-run preview and make no network call.

## Configuration

| Var | Required | Purpose |
| --- | --- | --- |
| `AEROAPI_API_KEY` | yes | Your AeroAPI key (sent as the `x-apikey` header). |
| `AEROAPI_OUTPUT_DIR` | no | Default directory for flight-map PNGs (default: cwd). |

## Development

```bash
npm install
npm run build
npm test
```

Every request rides your own AeroAPI key and counts against your subscription quota. See `docs/FLIGHTAWARE-API.md` for the pinned endpoint surface.

## License

MIT
