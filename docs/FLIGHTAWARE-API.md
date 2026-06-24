# FlightAware AeroAPI (v4) — surface notes

Authoritative, pinned request/response shapes for `flightaware-mcp`. Source: the
public OpenAPI sample (`https://www.flightaware.com/commercial/aeroapi/resources/aeroapi-openapi.yml`,
spec version 4.17.1 at capture time) plus the well-documented v4 surface. The
**full** spec (60+ endpoints) lives behind the authenticated developer portal.

> **Verification status.** Endpoints marked **[pinned-from-spec]** have their
> request shape confirmed against the public OpenAPI. Endpoints marked
> **[verify-pending]** are coded from the documented v4 surface and MUST be
> re-verified against a real `200`. See the live-verification results below.

## Live verification — 2026-06-23 (Personal tier key)

Confirmed against real `200`s (response field names verified): `fa_get_airport`
(`{airport_code, code_icao, code_iata, …}`), `fa_get_operator`
(`{icao, iata, callsign, name, …}`), `fa_get_airport_flights` (`{departures,
links, num_pages}`), `fa_get_flight_position`, `fa_get_flight_track`
(`{actual_distance, positions[]}`), `fa_get_flight_route` (`{route_distance,
fixes[]}`), `fa_get_flight_map` (`{map: "<base64 PNG>"}`, ~65 KB),
`fa_get_flights` (`{flights[], links, num_pages}`), `fa_get_aircraft_owner`
(`{owner}`), `fa_search_flights` (`{flights[], …}`), `fa_get_airport_delays`
(`{delays[], …}`), `fa_get_nearby_airports` (`{airports[], …}`),
`fa_get_airport_weather` (`{observations[], …}`), `fa_get_scheduled_flights`
(`{scheduled[], …}`).

**Tier-gated (verified `401` on the free Personal tier):** all `/alerts*`
endpoints AND `/history/*` (`fa_get_flight_history`). AeroAPI's body:
*"Alerts and Historical data are only available on Standard and Premium tiers."*
Note AeroAPI returns `401` (title "Invalid API key") for tier-gating, NOT
`402`/`403` — the client's 401 message names both causes so a valid Personal
key isn't mislabeled as invalid.

**Rate limiting:** the Personal tier throttles bursts — a dozen calls in a few
seconds drew `429`s that cleared when spaced. Interactive (one-call-at-a-time)
MCP use is unaffected; the client retries `429` once.

**Round 2 (also confirmed `200`):** `fa_list_airports` (`{airports[], …}`),
`fa_list_operators` (`{operators[], …}`), `fa_get_operator_flights`
(`{scheduled, arrivals, enroute, links, num_pages}` for the `all` board),
`fa_get_airport_weather` forecast (`{airport_code, raw_forecast, decoded_forecast, …}`),
and `fa_search_flights_advanced` (`{flights[], …}`).

**Advanced-query grammar (`/flights/search/advanced`):** a space-separated list
of `{operator key value}` predicates — NOT the simplified `-key value` syntax of
`fa_search_flights`. Verified example: `{match ident UAL*} {> alt 300}`. Field
names matter: it's `orig`/`dest` (ICAO), not `origin`/`destination`; `alt` is in
hundreds of feet. Operators: `true`/`false`/`null`/`notnull`/`=`/`!=`/`<`/`>`/
`<=`/`>=`/`match`/`notmatch`/`range`/`in`/`orig_or_dest`/`aircraftType`/`ident`/
`ident_or_reg`/`airline`. A malformed query returns `400` ("Undisclosed/Error").

**Round 3 (also confirmed `200`):** `fa_search_flight_positions`
(`{positions[], …}`, advanced grammar), `fa_count_flights` (`{count}`),
`fa_get_airport_flight_counts` (`{departed, enroute, scheduled_arrivals,
scheduled_departures}`), `fa_get_airport_routes` (`{routes[], …}`). The two
canonical resolvers (`fa_resolve_flight`, `fa_resolve_airport`) `401` on the
Personal tier — they're grouped with the Standard/Premium-only data.

**Still unexercised:** `fa_foresight_search` (premium add-on), and the
tier-gated `/alerts*`, `fa_get_flight_history`, `fa_resolve_*` (Standard/Premium).

**Response cache:** `client.get()` caches by full path for `AEROAPI_CACHE_TTL`
seconds (default 15; `0` disables) to cut per-query billing — helpful given the
rate-limit behavior above. Writes are never cached.

## Base + auth

- **Base URL:** `https://aeroapi.flightaware.com/aeroapi`
- **Auth header:** `x-apikey: <key>` (OpenAPI `ApiKeyAuth`, `in: header`, `name: x-apikey`).
  NOT `Authorization: Bearer`. We use `createApiClient({ tokenHeader: 'x-apikey' })`.
- **Response:** `application/json; charset=UTF-8`. Paged collections carry a
  `links.next` containing an opaque `cursor`; pass it back as `?cursor=`.
- **Rate/quota:** billed per query; free Personal tier = 500/mo. A `401` means a
  bad/missing key; `402`/`403` typically means the endpoint/feature is not in
  your subscription tier (notably **Foresight** and some premium boards).

## Common query params

- `max_pages` (int, default 1) — upper bound on pages fetched.
- `cursor` (string) — opaque paging token from `links.next`.
- `start` / `end` (ISO-8601 timestamps) — time window on flight/board/history calls.

## Flights

| Tool | Method + path | Notes |
| --- | --- | --- |
| `fa_get_flights` | `GET /flights/{ident}` | ident = flight ident (e.g. `UAL123`, `AAL100`), registration (`N12345`), or `fa_flight_id`. Query: `ident_type` (`designator`/`registration`/`fa_flight_id`), `start`, `end`, `max_pages`, `cursor`. Returns `{ flights: [...], links, num_pages }`. **[verify-pending]** |
| `fa_search_flights` | `GET /flights/search` | Simplified `-key value` query syntax (airborne flights). Keys: `-prefix -type -idents -identOrReg -airline -destination -origin -originOrDestination -aboveAltitude -belowAltitude -aboveGroundspeed -belowGroundspeed -latlong "MINLAT MINLON MAXLAT MAXLON" -filter {ga|airline}`. Query: `query`, `max_pages`, `cursor`. **[pinned-from-spec]** |
| `fa_search_flights_advanced` | `GET /flights/search/advanced` | Structured `{operator key value}` query language (see grammar note below). Query: `query`, `max_pages`, `cursor`. **[verified]** |
| `fa_search_flight_positions` | `GET /flights/search/positions` | Same `{operator key value}` grammar as advanced, returns `{positions[], links, num_pages}`. **[verified]** |
| `fa_count_flights` | `GET /flights/search/count` | SIMPLIFIED `-key value` syntax (pairs with `/flights/search`, NOT the advanced grammar — verified: advanced grammar `400`s here). Returns `{count}`. **[verified]** |
| `fa_resolve_flight` | `GET /flights/{ident}/canonical` | Canonical/alternate idents. Query: `ident_type`. **Standard/Premium tier** (Personal `401`s — verified). |
| `fa_get_flight_track` | `GET /flights/{id}/track` | id = `fa_flight_id`. Positions log. Query: `include_estimated_positions`. **[verify-pending]** |
| `fa_get_flight_position` | `GET /flights/{id}/position` | Last reported position for an in-air flight (`fa_flight_id`). **[verify-pending]** |
| `fa_get_flight_route` | `GET /flights/{id}/route` | Decoded route fixes. **[verify-pending]** |
| `fa_get_flight_map` | `GET /flights/{id}/map` | Returns `{ map: "<base64 PNG>" }`. Query: `height`, `width`, `layer_on`, `layer_off`, `show_data_block`, `bounding_box`. Binary-output tool: writes PNG to disk (or inline). **[verify-pending]** |
| `fa_get_flight_history` | `GET /history/flights/{ident}` | Historical flights by ident. Query: `ident_type`, `start`, `end`, `max_pages`, `cursor`. **[verify-pending]** |

## Airports

| Tool | Method + path | Notes |
| --- | --- | --- |
| `fa_get_airport` | `GET /airports/{id}` | id = ICAO (`KJFK`), IATA (`JFK`), or LID. **[verify-pending]** |
| `fa_get_airport_flights` | `GET /airports/{id}/flights[/{board}]` | board ∈ `all` (→ `/flights`), `arrivals`, `departures`, `scheduled_arrivals`, `scheduled_departures`. Query: `start`, `end`, `type` (`Airline`/`General_Aviation`), `max_pages`, `cursor`. **[verify-pending]** |
| `fa_list_airports` | `GET /airports` | Paged list of all airports. Query: `max_pages`, `cursor`. **[pinned-from-spec]** |
| `fa_get_nearby_airports` | `GET /airports/nearby` | Query (required): `latitude`, `longitude`, `radius` (statute miles). Optional: `only_iap`, `max_pages`, `cursor`. **[pinned-from-spec]** |
| `fa_get_airport_delays` | `GET /airports/delays` or `GET /airports/{id}/delays` | All current delays, or one airport's. Query: `max_pages`, `cursor`. **[pinned-from-spec]** (all-airports) / **[verify-pending]** (per-airport) |
| `fa_get_airport_weather` | `GET /airports/{id}/weather/{observations\|forecast}` | METAR observations or TAF forecast. **[verified]** |
| `fa_get_airport_flight_counts` | `GET /airports/{id}/flights/counts` | `{departed, enroute, scheduled_arrivals, scheduled_departures}`. **[verified]** |
| `fa_get_airport_routes` | `GET /airports/{id}/routes/{destination}` | Popular routes between two airports → `{routes[], links, num_pages}` (route objects carry `aircraft_types`, `count`, `filed_altitude_min/max`, `route`, `route_distance`). **[verified]** |
| `fa_resolve_airport` | `GET /airports/{id}/canonical` | Canonical airport id. Query: `id_type`. **Standard/Premium tier** (Personal `401`s — verified). |

## Operators

| Tool | Method + path | Notes |
| --- | --- | --- |
| `fa_get_operator` | `GET /operators/{id}` | id = ICAO (`UAL`) or IATA (`UA`). **[verify-pending]** |
| `fa_get_operator_flights` | `GET /operators/{id}/flights[/{board}]` | board ∈ `all`, `arrivals`, `departures`, `enroute`, `scheduled`. **[verify-pending]** |
| `fa_list_operators` | `GET /operators` | Paged list. **[pinned-from-spec]** |

## Aircraft

| Tool | Method + path | Notes |
| --- | --- | --- |
| `fa_get_aircraft_owner` | `GET /aircraft/{ident}/owner` | Registered owner of a tail number. **[verify-pending]** |

## Schedules & Foresight

| Tool | Method + path | Notes |
| --- | --- | --- |
| `fa_get_scheduled_flights` | `GET /schedules/{date_start}/{date_end}` | Dates `YYYY-MM-DD`. Query: `origin`, `destination`, `airline`, `flight_number`, `include_codeshares`, `max_pages`, `cursor`. **[verify-pending]** |
| `fa_foresight_search` | `GET /foresight/flights/search/advanced` | Predictive search. **Premium tier** — expect `402`/`403` on a Personal key. Query: `query`, `max_pages`, `cursor`. **[pinned-from-spec]** |

## Alerts (account-mutating — confirm-gated writes)

Alerts are push notifications on YOUR account. Mutations take `confirm: true`;
without it they return a dry-run preview and make NO network call.

| Tool | Method + path | Write? | Notes |
| --- | --- | --- | --- |
| `fa_list_alerts` | `GET /alerts` | read | `{ alerts: [...], links, num_pages }`. **[pinned-from-spec]** |
| `fa_get_alert` | `GET /alerts/{id}` | read | id = alert id (integer). **[verify-pending]** |
| `fa_create_alert` | `POST /alerts` | **write** | Body: `{ ident?, origin?, destination?, aircraft_type?, start_date?, end_date?, max_weekly?, eta?, arrival?, cancelled?, departure?, diverted?, filed?, hold?, events?, is_from_block? }`. Returns `Location` header with new alert id. **[verify-pending]** |
| `fa_update_alert` | `PUT /alerts/{id}` | **write** | Same body shape; replaces the alert. **[verify-pending]** |
| `fa_delete_alert` | `DELETE /alerts/{id}` | **write** | `204` on success. **[verify-pending]** |
| `fa_get_alerts_endpoint` | `GET /alerts/endpoint` | read | Current delivery (webhook) config. **[verify-pending]** |
| `fa_set_alerts_endpoint` | `PUT /alerts/endpoint` | **write** | Body: `{ url, format? }`. **[verify-pending]** |

## Path-injection guard

`ident` / `id` values are interpolated into the URL path. `fa_flight_id`s
contain hyphens (`UAL123-1700000000-airline-0123`); registrations and idents are
alphanumeric; airport/operator codes are alphanumeric. Allow `[A-Za-z0-9.-]` for
flight idents/ids, `[A-Za-z0-9]` for airport/operator codes, and integer-only
for alert ids — reject anything that could escape the segment (`/ .. ? #` ws).
