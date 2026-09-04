# Changelog

## [0.6.0](https://github.com/chrischall/hemnet-mcp/compare/v0.5.0...v0.6.0) (2026-09-04)


### Features

* **tools:** compact by default — strip media URLs, and minify every response ([#62](https://github.com/chrischall/hemnet-mcp/issues/62)) ([fc87771](https://github.com/chrischall/hemnet-mcp/commit/fc877715ace27868169676cee484f8e891ee45a6))


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
