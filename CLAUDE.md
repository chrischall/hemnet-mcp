# CLAUDE.md — hemnet-mcp

Guidance for Claude working in this repo.

## TL;DR

MCP server for **hemnet.se**, Sweden's largest property portal. Reads
active for-sale listings, sold prices (*slutpriser*), full listing
detail, photos, and market statistics; resolves place names and street
addresses; and does a local Swedish mortgage calculation. stdio
transport.

**Data access is a plain, anonymous GraphQL fetch — no auth, no browser
session, no fetchproxy.** This is the key architectural difference from
the fleet's fetchproxy members (homes-mcp, etc.): homes.com gates every
request behind AWS WAF at the session level, so it *must* ride the user's
Chrome tab per call. Hemnet serves its read queries to anonymous clients,
so hemnet-mcp talks to `https://www.hemnet.se/graphql` directly.

**Dual-purpose by design.** hemnet-mcp is both (1) a standalone stdio MCP
server (the `bin`), and (2) an importable library (`import … from
'hemnet-mcp'`, `src/lib.ts`) so the planned `@chrischall/realty-meta`
orchestrator in realty-mcp can consume Hemnet as one portal source. Keep
that split intact: tools depend on `HemnetClient`, the client returns
normalised records from `src/format.ts`, and nothing tool-specific leaks
into the library surface.

## Tool surface

All tools are prefixed `hemnet_*`. Every one is read-only
(`readOnlyHint: true`, `idempotentHint: true`); `openWorldHint` is `true`
for the network tools and `false` for `hemnet_calculate_mortgage` (pure
local math).

| Tool | File | Source | Kind |
| --- | --- | --- | --- |
| `hemnet_autocomplete_location` | `tools/autocomplete.ts` | `autocompleteLocations` | read |
| `hemnet_search_listings` | `tools/search.ts` | `searchForSaleListings` | read |
| `hemnet_get_listing` | `tools/listings.ts` | `listing(id)` | read |
| `hemnet_get_listing_photos` | `tools/photos.ts` | `listing(id).images` | read |
| `hemnet_search_sold` | `tools/sold.ts` | `searchSales` | read |
| `hemnet_get_sold_listing` | `tools/sold.ts` | `soldListing(id)` | read |
| `hemnet_get_market_stats` | `tools/market.ts` | `searchSales` → `computeMarketStats` | read |
| `hemnet_compare_listings` | `tools/compare.ts` | concurrent `listing(id)` | read |
| `hemnet_get_by_address` | `tools/by-address.ts` | autocomplete → search → `addressMatch` | read |
| `hemnet_calculate_mortgage` | `tools/mortgage.ts` | local (`src/mortgage.ts`) | read |
| `hemnet_healthcheck` | `tools/healthcheck.ts` | tiny `autocompleteLocations` probe | read |

## Architecture

```
src/
  index.ts              # stdio entry — builds DirectTransport + HemnetClient,
                        #   applies registerHemnetTools via runMcp()
  lib.ts                # LIBRARY entry (package `exports` "."): re-exports the
                        #   client, formatters, record types, pure derivations,
                        #   and registrars for realty-meta. createHemnetClient().
  transport.ts          # HemnetTransport interface (graphql(query, variables))
  transport-direct.ts   # DirectTransport — default direct fetch, retry/backoff
  client.ts             # HemnetClient — typed query methods; GraphQL errors →
                        #   McpToolError (redacted); null/typename guards
  graphql.ts            # GraphQL operation strings + raw response types +
                        #   HousingFormGroup/Sort enums + HemnetSearchInput
  format.ts             # raw GraphQL nodes → normalised snake_case records
                        #   (SEK numbers, m², derived price_per_sqm)
  money.ts              # Swedish number parsing ("3 995 000 kr" → 3995000)
  url.ts                # extractListingId (trailing digits), url builders
  stats.ts              # computeMarketStats (median/avg over sold rows)
  mortgage.ts           # calculateSwedishMortgage (amorteringskrav, ränteavdrag)
  mcp.ts                # re-exports textResult from @chrischall/mcp-utils
  tools/
    _shared.ts          # searchInputShape (zod) + buildSearchInput (location
                        #   resolution + filter mapping), shared by search/sold/market
    index.ts            # registrar barrel + registerHemnetTools()
    autocomplete.ts search.ts listings.ts photos.ts sold.ts
    market.ts compare.ts by-address.ts mortgage.ts healthcheck.ts
tests/                  # 1:1 mirror of src/. FakeTransport (helpers.ts) drives
                        #   every tool + the client with zero network.
```

Each `tools/*.ts` exports `registerXTools(server, client)` (or `(server)`
for the local-only mortgage tool). `registerHemnetTools` in
`tools/index.ts` wires them all up; `index.ts` and realty-meta both call
it.

## Commands

```bash
npm install
npm run build          # tsc → dist/ (with .d.ts for the library) + esbuild bundle → dist/bundle.js
npm test               # vitest run
npm run test:coverage  # v8 coverage — 100% enforced on src/** (excl. index.ts)
npm run typecheck      # tsc --noEmit
node dist/index.js     # launch the stdio server
```

## Conventions

- All tools prefixed `hemnet_*`; return via `textResult(data)` from
  `src/mcp.ts` — don't hand-roll the content envelope.
- **ESM + NodeNext**: `.js` extensions on relative imports even from
  `.ts`. `verbatimModuleSyntax` is on → `import type` for type-only
  imports. `noUncheckedIndexedAccess` is on → narrow indexed access.
- **Money is always a number of SEK** in the output records; keep the
  original Hemnet string alongside as `*_formatted` for display.
- **Swedish/portal-specific logic stays here**, not in
  `@chrischall/realty-core` (whose helpers are US-centric: USD, sqft,
  ZIP). Only realty-core's portal-agnostic helpers are used — currently
  `addressMatch` in `tools/by-address.ts`.
- Write a failing test before implementation (TDD). Tests mock the
  transport, never the network. Coverage is the gate (100% on `src/**`).
- stdio: stdout is JSON-RPC; log banners/warnings to **stderr** only.

## Hemnet / GraphQL quirks

- **Introspection is disabled** on `/graphql`. The operations in
  `src/graphql.ts` were reverse-engineered from the SSR
  `__APOLLO_STATE__` cache and the API's "Did you mean" validation hints.
  Every selected field is confirmed live. When adding a field, verify it
  against the live endpoint first.
- **Search takes numeric `locationIds`, never a place name.** Resolve via
  `autocompleteLocations` first (`buildSearchInput` does this when a tool
  is given a free-text `location`).
- **Card vs. detail money shape.** `searchForSaleListings.listings` and
  `searchSales.cards` return money as pre-formatted Swedish strings
  (`"3 995 000 kr"`), while the `listing`/`soldListing` detail nodes
  return structured `Money { amount, formatted }`. `src/money.ts` +
  `src/format.ts` erase that difference.
- **`listing` returns the `PropertyListing` interface**; the full detail
  fields live behind an `... on ActivePropertyListing` inline fragment.
  `HemnetClient.getListing` returns `null` for a non-active typename so
  the caller can fall back to `getSoldListing`.
- **Sold nodes are a different type** (`SoldPropertyListing`) with
  renamed fields: `sellingPrice` (not `finalPrice`),
  `squareMeterSellingPrice`, `hemnetUrl` (not `listingHemnetUrl`), no
  `region`/`description`.
- **Housing form filter** is `housingFormGroups` with plural enum values
  (`APARTMENTS`, `HOUSES`, `ROW_HOUSES`, `VACATION_HOMES`, `PLOTS`,
  `OTHERS`). Sort enums (`ListingSearchForSaleSorting`/`SaleSearchSorting`)
  only expose `NEWEST`/`OLDEST`.
- **The number-drop in address matching**: realty-core's `tokenize`
  drops a street number that isn't the first token, and the numeric
  anchor only fires on surviving numeric tokens — relevant when reasoning
  about `hemnet_get_by_address` recall.

## Library use (realty-meta)

`src/lib.ts` is the `exports["."]` entry. It re-exports `HemnetClient`,
`DirectTransport`, `createHemnetClient()`, all `format*` functions and
their record types (`ListingSummary`, `ListingDetail`, `SoldSummary`,
…), `computeMarketStats`, `calculateSwedishMortgage`, the money/url
helpers, the search-input types, and every registrar. A consumer can
either embed the tools (`registerHemnetTools(server, client)`) or use the
client + formatters directly to produce normalised records for
cross-portal comparison. `npm run build` emits `.d.ts` alongside the JS so
the types come through.

## Publishing constraints

The MCP Registry caps `server.json`'s `description` at **100 characters**
(HTTP 422 otherwise). Sanity-check before committing a change:

```bash
node -e "console.log(require('./server.json').description.length)"
```

## Versioning (release-please — do not hand-bump)

`release-please` owns versioning. The `VERSION` literal in `src/index.ts`
is marked `// x-release-please-version` and asserted against
`package.json#version` by `tests/version-sync.test.ts`. Version lives in:
`package.json`, `package-lock.json`, `src/index.ts`, `manifest.json`,
`server.json` (`$.version` + `$.packages[*].version`),
`.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json` — all
registered in `release-please-config.json` `extra-files`. Conventional-
commit PR titles drive the bump (`feat:` minor, `fix:` patch, `feat!:`
major; `chore`/`docs`/`ci`/`test`/`build`/`refactor` don't release).

## Pull requests

**Default workflow: branch + PR.** The repo squash-merges, so the **PR
title must be a Conventional Commit** — it becomes the squash subject
release-please parses. Don't run `gh pr merge` yourself:
`pr-auto-review.yml` reviews every PR and arms `ready-to-merge` on a
`pass`/`warn` verdict; `auto-merge.yml` then arms `gh pr merge --auto
--squash`. Only a `fail` blocks (override by adding the label yourself).
Open a PR only when the change is genuinely done — it can auto-merge as
soon as review passes.

**First-party dependency bumps** (`@chrischall/mcp-utils`,
`@chrischall/realty-core`) use `feat:`/`fix:`, not `chore:` — they ship
real changes through us and should drive a release.

### Auto-review follow-up issues

When a PR's auto-review verdict is `warn` or `fail`, the
`chrischall/workflows` pipeline opens/updates a single
`auto-review-followup` issue and links it from the verdict comment. When
asked to address review findings: read the verdict comment, open the
linked issue, treat its checklist as the work list, check off only what
you've verified fixed, and add `Closes #<issue>` to the PR body when all
items are resolved.
