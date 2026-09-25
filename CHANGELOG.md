# Changelog

## [1.1.5](https://github.com/chrischall/hemnet-mcp/compare/v1.1.4...v1.1.5) (2026-09-25)


### Bug Fixes

* **deps:** take realty-core 0.4.8 address matching (wrong house, unit numbers) ([#111](https://github.com/chrischall/hemnet-mcp/issues/111)) ([89745e5](https://github.com/chrischall/hemnet-mcp/commit/89745e5079072520b0be78fed6ff1582e4e988d3))

## [1.1.4](https://github.com/chrischall/hemnet-mcp/compare/v1.1.3...v1.1.4) (2026-09-23)


### Bug Fixes

* current Swedish mortgage rules and full-location address resolution ([#106](https://github.com/chrischall/hemnet-mcp/issues/106)) ([54c745a](https://github.com/chrischall/hemnet-mcp/commit/54c745afb74aa932ad6e77ae3a94b38fc9a26f0d))

## [1.1.3](https://github.com/chrischall/hemnet-mcp/compare/v1.1.2...v1.1.3) (2026-09-23)


### Bug Fixes

* **deps:** require zod ^4.6.5 to match @chrischall/mcp-utils 2.4.0 ([#104](https://github.com/chrischall/hemnet-mcp/issues/104)) ([4976983](https://github.com/chrischall/hemnet-mcp/commit/4976983d5ca03255308b635feccdd8653694bf36))
* **deps:** upgrade @chrischall/mcp-utils to 2.4.0 and @fetchproxy/* to 3.2.0 ([#99](https://github.com/chrischall/hemnet-mcp/issues/99)) ([499b8ac](https://github.com/chrischall/hemnet-mcp/commit/499b8acaf1dd5a898eb6a72431979711684abda5))
* **fetchproxy:** an escaped """ in a GraphQL block string can no longer hide a mutation ([#105](https://github.com/chrischall/hemnet-mcp/issues/105)) ([a1cf84d](https://github.com/chrischall/hemnet-mcp/commit/a1cf84d011fb714a700c7e71900fe3d27ddb5a71)), closes [#103](https://github.com/chrischall/hemnet-mcp/issues/103)
* **fetchproxy:** never treat a comment-prefixed GraphQL mutation as read-only ([#102](https://github.com/chrischall/hemnet-mcp/issues/102)) ([edd145c](https://github.com/chrischall/hemnet-mcp/commit/edd145c9ca052d3179ec7391b06fc467e94da3f8))

## [1.1.2](https://github.com/chrischall/hemnet-mcp/compare/v1.1.1...v1.1.2) (2026-09-21)


### Documentation

* AGENTS.md should not say it is guidance for Claude ([#97](https://github.com/chrischall/hemnet-mcp/issues/97)) ([b9c585a](https://github.com/chrischall/hemnet-mcp/commit/b9c585a5fcf416adb20187fd8b9a97013ab95c1d))

## [1.1.1](https://github.com/chrischall/hemnet-mcp/compare/v1.1.0...v1.1.1) (2026-09-21)


### Documentation

* AGENTS.md pointed at a directory that does not exist ([#95](https://github.com/chrischall/hemnet-mcp/issues/95)) ([4b1528a](https://github.com/chrischall/hemnet-mcp/commit/4b1528a2fc63e5a039c706fe78e354ffc681926e))

## [1.1.0](https://github.com/chrischall/hemnet-mcp/compare/v1.0.0...v1.1.0) (2026-09-19)


### Features

* **deps:** take mcp-utils 1.0.0, so the server boots through serveStdio ([#93](https://github.com/chrischall/hemnet-mcp/issues/93)) ([0055a68](https://github.com/chrischall/hemnet-mcp/commit/0055a6813b7de4c52a5eb6eab1a76cd50cd21453))

## [1.0.0](https://github.com/chrischall/hemnet-mcp/compare/v0.6.5...v1.0.0) (2026-09-19)


### ⚠ BREAKING CHANGES

* **mcp:** migrate server to SDK v2 ([#90](https://github.com/chrischall/hemnet-mcp/issues/90))

### Features

* **mcp:** migrate server to SDK v2 ([#90](https://github.com/chrischall/hemnet-mcp/issues/90)) ([71a1e35](https://github.com/chrischall/hemnet-mcp/commit/71a1e352a712085a28fab81dc5576d66424bcfce))

## [0.6.5](https://github.com/chrischall/hemnet-mcp/compare/v0.6.4...v0.6.5) (2026-09-17)


### Bug Fixes

* **deps:** Bump the production-dependencies group with 2 updates ([#88](https://github.com/chrischall/hemnet-mcp/issues/88)) ([f14a3f8](https://github.com/chrischall/hemnet-mcp/commit/f14a3f87d7bcf454bbb9910cd765e25b64f9c836))

## [0.6.4](https://github.com/chrischall/hemnet-mcp/compare/v0.6.3...v0.6.4) (2026-09-15)


### Bug Fixes

* **deps:** @fetchproxy/server 3.0.1 — capped peer frames, logged load drops, atomic identity writes ([#84](https://github.com/chrischall/hemnet-mcp/issues/84)) ([39aa5a4](https://github.com/chrischall/hemnet-mcp/commit/39aa5a4f0e553d9d043c4e305799983ab07f054a))

## [0.6.3](https://github.com/chrischall/hemnet-mcp/compare/v0.6.2...v0.6.3) (2026-09-14)


### Bug Fixes

* **deps:** @fetchproxy/server 2.11.3, so the hosted extension pin persists ([#81](https://github.com/chrischall/hemnet-mcp/issues/81)) ([40522c8](https://github.com/chrischall/hemnet-mcp/commit/40522c838e06769c7b0c56f7b11fa9e2a79f2a4b))
* **deps:** @fetchproxy/server 3.0.0 — protocol v4 (forward secrecy, AAD over the frame) ([#83](https://github.com/chrischall/hemnet-mcp/issues/83)) ([d9201c1](https://github.com/chrischall/hemnet-mcp/commit/d9201c197e795001e76accde2073e80bc1b5a359))

## [0.6.2](https://github.com/chrischall/hemnet-mcp/compare/v0.6.1...v0.6.2) (2026-09-10)


### Bug Fixes

* **deps:** @fetchproxy/server 2.10.0 and @chrischall/mcp-utils 0.26.1 ([#79](https://github.com/chrischall/hemnet-mcp/issues/79)) ([4afe9fa](https://github.com/chrischall/hemnet-mcp/commit/4afe9fa92717acbe55f088620ee5bd3338720270))
* **deps:** declare the peer floors mcp-utils 0.26.1 requires ([#80](https://github.com/chrischall/hemnet-mcp/issues/80)) ([1f413d5](https://github.com/chrischall/hemnet-mcp/commit/1f413d5904f9127a261b07c3066c014e222cb347))
* **deps:** take @fetchproxy/server 2.9.1 so a pairing prompt survives ([#76](https://github.com/chrischall/hemnet-mcp/issues/76)) ([5872e91](https://github.com/chrischall/hemnet-mcp/commit/5872e912b42c2d998111e1bea4f61b29dbd71b1f))

## [0.6.1](https://github.com/chrischall/hemnet-mcp/compare/v0.6.0...v0.6.1) (2026-09-09)


### Bug Fixes

* **deps:** Bump fast-uri from 3.1.5 to 3.1.7 ([#74](https://github.com/chrischall/hemnet-mcp/issues/74)) ([a9080db](https://github.com/chrischall/hemnet-mcp/commit/a9080dba7961edd3257cc8a1ed206c65074d7647))
* **deps:** Bump qs from 6.15.2 to 6.16.0 ([#75](https://github.com/chrischall/hemnet-mcp/issues/75)) ([f5e65f5](https://github.com/chrischall/hemnet-mcp/commit/f5e65f504945c6d19264b4435acac2bbbf3c2246))
* **deps:** require @fetchproxy/server ^2.7.0, the first that reads FETCHPROXY_IDENTITY_DIR ([#72](https://github.com/chrischall/hemnet-mcp/issues/72)) ([8e1c6f9](https://github.com/chrischall/hemnet-mcp/commit/8e1c6f9abf74e2bb4a57c953f797e25a5384b3db))

## [0.6.0](https://github.com/chrischall/hemnet-mcp/compare/v0.5.0...v0.6.0) (2026-09-04)


### Features

* **tools:** minify every response — no formatting whitespace on any payload ([#62](https://github.com/chrischall/hemnet-mcp/issues/62)) ([fc87771](https://github.com/chrischall/hemnet-mcp/commit/fc877715ace27868169676cee484f8e891ee45a6))


### Refactor

* **imports:** import minifiedResult from the mcp-utils barrel directly ([#66](https://github.com/chrischall/hemnet-mcp/issues/66)) ([89709ec](https://github.com/chrischall/hemnet-mcp/commit/89709ec9345e885515df804a3db4c26cdbfab0e5))

## [0.5.0](https://github.com/chrischall/hemnet-mcp/compare/v0.4.0...v0.5.0) (2026-09-02)


### Features

* **healthcheck:** adopt the shared bridge healthcheck and report the extension link state ([#55](https://github.com/chrischall/hemnet-mcp/issues/55)) ([aa04a67](https://github.com/chrischall/hemnet-mcp/commit/aa04a676185bef682d08ca8092c2f95a11e328b4))
* **healthcheck:** report which transport served the probe and the bridge state ([#53](https://github.com/chrischall/hemnet-mcp/issues/53)) ([50db3df](https://github.com/chrischall/hemnet-mcp/commit/50db3df2082fc7b642e4714721c73b50e74033a3))


### Bug Fixes

* **healthcheck:** classify the bridge leg's challenge page and HTTP failures, and fail a zero-hit probe ([#57](https://github.com/chrischall/hemnet-mcp/issues/57)) ([1eaa143](https://github.com/chrischall/hemnet-mcp/commit/1eaa1438f68e1a9d8d3d427b01d9dbe9eb184efd))
* **healthcheck:** type the bridge leg's HTTP failure instead of matching its message ([#59](https://github.com/chrischall/hemnet-mcp/issues/59)) ([54589f1](https://github.com/chrischall/hemnet-mcp/commit/54589f10be573709554ed79ffb505bce626311e9))

## [0.4.0](https://github.com/chrischall/hemnet-mcp/compare/v0.3.3...v0.4.0) (2026-08-29)


### Features

* **deps:** take @fetchproxy/server 2.2.0 so the concentrator can bind its sandbox address ([#43](https://github.com/chrischall/hemnet-mcp/issues/43)) ([0a9b7cb](https://github.com/chrischall/hemnet-mcp/commit/0a9b7cbed09ddfb7abf44a9cb3fe1a4fed40acac))

## [0.3.3](https://github.com/chrischall/hemnet-mcp/compare/v0.3.2...v0.3.3) (2026-08-28)


### Bug Fixes

* **egress:** declare only the hosts the server process dials in mint.yaml ([#41](https://github.com/chrischall/hemnet-mcp/issues/41)) ([71028dd](https://github.com/chrischall/hemnet-mcp/commit/71028dd4e569c6d9308de281ae85ecc1a77acd7b))

## [0.3.2](https://github.com/chrischall/hemnet-mcp/compare/v0.3.1...v0.3.2) (2026-08-06)


### Bug Fixes

* **deps:** move to @fetchproxy/server 2.0.0 for the v3 handshake ([#27](https://github.com/chrischall/hemnet-mcp/issues/27)) ([fcf2e03](https://github.com/chrischall/hemnet-mcp/commit/fcf2e03345073ef47cc53c6453b47d536daf967d))

## [0.3.1](https://github.com/chrischall/hemnet-mcp/compare/v0.3.0...v0.3.1) (2026-07-30)


### Bug Fixes

* **deps:** bump @fetchproxy/* to 1.7.0 and @chrischall/mcp-utils to 0.14.0 ([#20](https://github.com/chrischall/hemnet-mcp/issues/20)) ([5310faa](https://github.com/chrischall/hemnet-mcp/commit/5310faa0099436ab94584c3ce8ee9b7a5e5d15fe))

## [0.3.0](https://github.com/chrischall/hemnet-mcp/compare/v0.2.0...v0.3.0) (2026-07-13)


### Features

* add hemnet-fpx skill for querying Hemnet via the fpx CLI without the MCP ([#10](https://github.com/chrischall/hemnet-mcp/issues/10)) ([4e36d3a](https://github.com/chrischall/hemnet-mcp/commit/4e36d3a8e60d1aab609474317f119f0952de676e))


### Bug Fixes

* address PR [#6](https://github.com/chrischall/hemnet-mcp/issues/6) auto-review nits ([#9](https://github.com/chrischall/hemnet-mcp/issues/9)) ([8000958](https://github.com/chrischall/hemnet-mcp/commit/8000958999f65cdadc81cce4080710d7105f44ef)), closes [#7](https://github.com/chrischall/hemnet-mcp/issues/7)
* restore Hemnet reads via browser-bridge fallback when Cloudflare-walled ([#6](https://github.com/chrischall/hemnet-mcp/issues/6)) ([fb25f3f](https://github.com/chrischall/hemnet-mcp/commit/fb25f3fad0f2dbd73fa9ce91ab253bebf47aa68d))

## [0.2.0](https://github.com/chrischall/hemnet-mcp/compare/v0.1.0...v0.2.0) (2026-07-09)


### Features

* hemnet.se MCP server (search, sold prices, listings, market stats) ([#4](https://github.com/chrischall/hemnet-mcp/issues/4)) ([b104b57](https://github.com/chrischall/hemnet-mcp/commit/b104b57d80de54044adee63ba4cd80af7924b66c))

## Changelog

All notable changes to hemnet-mcp are documented here. Versioning is
managed by release-please from Conventional Commit history.
