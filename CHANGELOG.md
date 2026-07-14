# Changelog

## [0.3.2](https://github.com/chrischall/flightaware-mcp/compare/v0.3.1...v0.3.2) (2026-07-14)


### Bug Fixes

* **plugin:** address review findings ([#24](https://github.com/chrischall/flightaware-mcp/issues/24)) ([725cb6b](https://github.com/chrischall/flightaware-mcp/commit/725cb6b3a206f59ecf46cc4e5a8f4b54528fd99f))
* **plugin:** move SKILL.md into skills/ directory so plugin skills load ([#22](https://github.com/chrischall/flightaware-mcp/issues/22)) ([460e7bc](https://github.com/chrischall/flightaware-mcp/commit/460e7bc57b62c8207d9f6390c2cc68f5a1a7eb89))

## [0.3.1](https://github.com/chrischall/flightaware-mcp/compare/v0.3.0...v0.3.1) (2026-07-07)


### Bug Fixes

* bump @chrischall/mcp-utils to 0.12.0 ([#20](https://github.com/chrischall/flightaware-mcp/issues/20)) ([4ac6675](https://github.com/chrischall/flightaware-mcp/commit/4ac66753fcc81e79ea073e26ce20fde6ef6e7b34))
* cap max_pages to bound AeroAPI billing ([#13](https://github.com/chrischall/flightaware-mcp/issues/13)) ([c5c1dd9](https://github.com/chrischall/flightaware-mcp/commit/c5c1dd99ef063152f4fc24db3fea547ca513cb25))


### Refactor

* adopt mcp-utils createResponseCache + readTtlMsEnv ([#17](https://github.com/chrischall/flightaware-mcp/issues/17)) ([36ce24c](https://github.com/chrischall/flightaware-mcp/commit/36ce24cd11f016071b0db37c533c3d48d64125dc))


### Documentation

* document first-party dependency-bump label exception ([#21](https://github.com/chrischall/flightaware-mcp/issues/21)) ([1aca6ae](https://github.com/chrischall/flightaware-mcp/commit/1aca6aee69db1fe81d1a9f08c9e93e005091d1e7))
* fix stale CACHE_MAX_ENTRIES comment in cache eviction test ([#19](https://github.com/chrischall/flightaware-mcp/issues/19)) ([ac5f7b3](https://github.com/chrischall/flightaware-mcp/commit/ac5f7b389734fd08bc19f7dc93fe2fd6e6573fb6))

## [0.3.0](https://github.com/chrischall/flightaware-mcp/compare/v0.2.0...v0.3.0) (2026-06-25)


### Features

* add search-positions/count, canonical resolvers, airport routes/counts + response cache ([#5](https://github.com/chrischall/flightaware-mcp/issues/5)) ([97f84fd](https://github.com/chrischall/flightaware-mcp/commit/97f84fddd729acd91b2e36d457e0f1af9f912d2d))
* two-tier read cache — longer TTL for static reference data ([#8](https://github.com/chrischall/flightaware-mcp/issues/8)) ([8f4d5eb](https://github.com/chrischall/flightaware-mcp/commit/8f4d5ebeae95756f4b19e83aa7ba7560b3445ae8))

## [0.2.0](https://github.com/chrischall/flightaware-mcp/compare/v0.1.0...v0.2.0) (2026-06-24)


### Features

* initial flightaware-mcp — FlightAware AeroAPI MCP server ([f75fd9b](https://github.com/chrischall/flightaware-mcp/commit/f75fd9b2cd1cfde98d7b8cdfb83b81c73e160bde))


### Bug Fixes

* tier-aware 401 message + mark alerts/history as Standard/Premium tier ([#3](https://github.com/chrischall/flightaware-mcp/issues/3)) ([17f7318](https://github.com/chrischall/flightaware-mcp/commit/17f7318344e3110510226893ac0157988eca91da))


### Documentation

* correct fa_search_flights_advanced query grammar + round-2 verification ([#4](https://github.com/chrischall/flightaware-mcp/issues/4)) ([4e396d4](https://github.com/chrischall/flightaware-mcp/commit/4e396d43f39ddf63bccd70865abdf30cb2359a2b))
