# Changelog

## [1.1.2](https://github.com/chrischall/flightaware-mcp/compare/v1.1.1...v1.1.2) (2026-09-23)


### Bug Fixes

* **flights:** stop marking fa_get_flight_map read-only ([#122](https://github.com/chrischall/flightaware-mcp/issues/122)) ([8a7f52e](https://github.com/chrischall/flightaware-mcp/commit/8a7f52e843f48471eb9901825689564c2d9fb5c6))

## [1.1.1](https://github.com/chrischall/flightaware-mcp/compare/v1.1.0...v1.1.1) (2026-09-23)


### Bug Fixes

* **deps:** Bump dotenv from 17.4.2 to 18.0.1 ([#118](https://github.com/chrischall/flightaware-mcp/issues/118)) ([dd0b0fe](https://github.com/chrischall/flightaware-mcp/commit/dd0b0fe3c2fbb583a32b73fc41a9950fb811e3fd))
* **deps:** Bump zod in the production-dependencies group ([#117](https://github.com/chrischall/flightaware-mcp/issues/117)) ([c9049e5](https://github.com/chrischall/flightaware-mcp/commit/c9049e5317cfa19430972be8a88aa00ba14088ef))
* **deps:** require zod ^4.6.5 to match @chrischall/mcp-utils 2.4.0 ([#121](https://github.com/chrischall/flightaware-mcp/issues/121)) ([8fca58c](https://github.com/chrischall/flightaware-mcp/commit/8fca58c5ac88dfcef8a534d3d07811d512c53b94))
* **deps:** upgrade @chrischall/mcp-utils to 2.4.0 and @fetchproxy/* to 3.2.0 ([#120](https://github.com/chrischall/flightaware-mcp/issues/120)) ([1d0e40e](https://github.com/chrischall/flightaware-mcp/commit/1d0e40e442c13b1725881296fad4fb328c0f622e))

## [1.1.0](https://github.com/chrischall/flightaware-mcp/compare/v1.0.0...v1.1.0) (2026-09-19)


### Features

* **deps:** take mcp-utils 1.0.0, fixing server/discover ([#112](https://github.com/chrischall/flightaware-mcp/issues/112)) ([0fa61ed](https://github.com/chrischall/flightaware-mcp/commit/0fa61ed3baf64068c90f7aeb87edcaa38a43e1c0))

## [1.0.0](https://github.com/chrischall/flightaware-mcp/compare/v0.5.3...v1.0.0) (2026-09-17)


### ⚠ BREAKING CHANGES

* **mcp:** migrate server to SDK v2 ([#106](https://github.com/chrischall/flightaware-mcp/issues/106))

### Features

* **mcp:** migrate server to SDK v2 ([#106](https://github.com/chrischall/flightaware-mcp/issues/106)) ([7dfa631](https://github.com/chrischall/flightaware-mcp/commit/7dfa63110b19c5e58a808ebb96fcb77906cae4e5))


### Bug Fixes

* **mcp:** verify SDK v2 tool schemas ([#109](https://github.com/chrischall/flightaware-mcp/issues/109)) ([e855a13](https://github.com/chrischall/flightaware-mcp/commit/e855a1346711f36e5597ea43204f33e3f7862a43))

## [0.5.3](https://github.com/chrischall/flightaware-mcp/compare/v0.5.2...v0.5.3) (2026-09-15)


### Bug Fixes

* **deps:** Bump the production-dependencies group with 2 updates ([#103](https://github.com/chrischall/flightaware-mcp/issues/103)) ([f3ab7e6](https://github.com/chrischall/flightaware-mcp/commit/f3ab7e69a8f7a99f64c9e2cecc9ad7206f08f2c1))

## [0.5.2](https://github.com/chrischall/flightaware-mcp/compare/v0.5.1...v0.5.2) (2026-09-10)


### Bug Fixes

* **deps:** @chrischall/mcp-utils 0.26.1 ([#100](https://github.com/chrischall/flightaware-mcp/issues/100)) ([83c8940](https://github.com/chrischall/flightaware-mcp/commit/83c8940828095b2fd0026a8ccaca950d5cbc2d97))
* **deps:** Bump hono from 4.13.0 to 4.13.7 ([#98](https://github.com/chrischall/flightaware-mcp/issues/98)) ([b70eb75](https://github.com/chrischall/flightaware-mcp/commit/b70eb75cfd867b8ea3403c9825804388d9b81cc7))

## [0.5.1](https://github.com/chrischall/flightaware-mcp/compare/v0.5.0...v0.5.1) (2026-09-04)


### Documentation

* **skill:** document the `view` response shape ([#90](https://github.com/chrischall/flightaware-mcp/issues/90)) ([079d7ab](https://github.com/chrischall/flightaware-mcp/commit/079d7abf2fd4e54c8ed2d5d274737bdec1255211))

## [0.5.0](https://github.com/chrischall/flightaware-mcp/compare/v0.4.0...v0.5.0) (2026-09-04)


### Features

* **tools:** compact by default — strip media URLs, and minify every response ([#81](https://github.com/chrischall/flightaware-mcp/issues/81)) ([b9a194b](https://github.com/chrischall/flightaware-mcp/commit/b9a194b2ea9ed924275f5d101121c37446b3433d))


### Bug Fixes

* **build:** restore the literal em dash in the package description ([#85](https://github.com/chrischall/flightaware-mcp/issues/85)) ([0f169fa](https://github.com/chrischall/flightaware-mcp/commit/0f169fadb72ead758b8417d89940c102cc8a6f45))
* **deps:** pick up @chrischall/mcp-utils 0.23.1 ([#86](https://github.com/chrischall/flightaware-mcp/issues/86)) ([fe9368b](https://github.com/chrischall/flightaware-mcp/commit/fe9368b32fe5e263cd9aefce53219ccf99f8f63d))
* **deps:** pick up @chrischall/mcp-utils 0.23.2 ([#88](https://github.com/chrischall/flightaware-mcp/issues/88)) ([a2dc94d](https://github.com/chrischall/flightaware-mcp/commit/a2dc94dff9c2f2695c7c0180f2b9db72986c7e5a))


### Refactor

* **tools:** drop the dead textResult imports left by the view rollout ([#89](https://github.com/chrischall/flightaware-mcp/issues/89)) ([ab4c82e](https://github.com/chrischall/flightaware-mcp/commit/ab4c82ec68b0ef37256195d7ef08412dd74ff32d))

## [0.4.0](https://github.com/chrischall/flightaware-mcp/compare/v0.3.5...v0.4.0) (2026-09-01)


### Features

* **health:** add fa_healthcheck ([#69](https://github.com/chrischall/flightaware-mcp/issues/69)) ([07e2df3](https://github.com/chrischall/flightaware-mcp/commit/07e2df3cbbc5d8fc8de4a941443294e66090a708))


### Documentation

* **health:** add fa_healthcheck to the README tools table ([#74](https://github.com/chrischall/flightaware-mcp/issues/74)) ([4af4a72](https://github.com/chrischall/flightaware-mcp/commit/4af4a72af6853b061281f0061651c7d50155c09a)), closes [#73](https://github.com/chrischall/flightaware-mcp/issues/73)
* **health:** list fa_healthcheck in manifest.json and the tool docs ([#72](https://github.com/chrischall/flightaware-mcp/issues/72)) ([b9410be](https://github.com/chrischall/flightaware-mcp/commit/b9410beff8aa74afb83d234e2c499bec36f0fe26))

## [0.3.5](https://github.com/chrischall/flightaware-mcp/compare/v0.3.4...v0.3.5) (2026-08-26)


### Bug Fixes

* use the full AeroAPI portal URL in the mint.yaml help text ([#55](https://github.com/chrischall/flightaware-mcp/issues/55)) ([57e980d](https://github.com/chrischall/flightaware-mcp/commit/57e980d310289c6b9636dd5e4b407a0655e77c2e)), closes [#54](https://github.com/chrischall/flightaware-mcp/issues/54)

## [0.3.4](https://github.com/chrischall/flightaware-mcp/compare/v0.3.3...v0.3.4) (2026-07-27)


### Bug Fixes

* **release:** restore the skill-path pin dropped by the pipeline sweep ([#36](https://github.com/chrischall/flightaware-mcp/issues/36)) ([c150e2a](https://github.com/chrischall/flightaware-mcp/commit/c150e2a28730f67d772dbd44adf3c6dde7243197))

## [0.3.3](https://github.com/chrischall/flightaware-mcp/compare/v0.3.2...v0.3.3) (2026-07-25)


### Bug Fixes

* **deps:** bump fast-uri out of the host-confusion advisories ([#33](https://github.com/chrischall/flightaware-mcp/issues/33)) ([a274cfa](https://github.com/chrischall/flightaware-mcp/commit/a274cfa6c0aff4f08ca3568628749083826f9be5))

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
