# Hemnet MCP

[![CI](https://github.com/chrischall/hemnet-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/chrischall/hemnet-mcp/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/hemnet-mcp)](https://www.npmjs.com/package/hemnet-mcp)
[![license](https://img.shields.io/npm/l/hemnet-mcp)](LICENSE)

An [MCP](https://modelcontextprotocol.io) server for **[hemnet.se](https://www.hemnet.se)**,
Sweden's largest real-estate portal. Search for-sale listings, look up
sold prices (*slutpriser*), pull full listing detail and photos, compute
market statistics, resolve addresses, and run a Swedish mortgage
calculation — all from Claude.

> ⚠️ This project is **built and maintained by AI (Claude)**. It reads
> hemnet.se through its public GraphQL API. Use at your own discretion
> and within hemnet.se's terms of service.

## Highlights

- **No configuration.** Hemnet serves its read queries anonymously — no
  login, no API key, no browser extension. `npx hemnet-mcp` just works.
- **Sold prices (slutpriser).** Hemnet's signature dataset: achieved
  final price, asking price, and over/under-asking percentage — the comps
  an agent needs to value a home.
- **Swedish-native.** Money in SEK, areas in m², rooms, `bostadsrätt`
  fees (avgift), energy class, and a mortgage model that follows Swedish
  rules (amorteringskrav, ränteavdrag).
- **Embeddable.** Ships as a standalone MCP server *and* as a library so
  it can be composed into a larger multi-portal server.

## Install

### Claude Code / Claude Desktop (npx)

```json
{
  "mcpServers": {
    "hemnet": {
      "command": "npx",
      "args": ["-y", "hemnet-mcp"]
    }
  }
}
```

### From source

```bash
git clone https://github.com/chrischall/hemnet-mcp
cd hemnet-mcp
npm install
npm run build
node dist/index.js
```

## Tools

| Tool | What it does |
| --- | --- |
| `hemnet_autocomplete_location` | Resolve a place name (`"Vasastan"`) to Hemnet location ids — the starting point for search. |
| `hemnet_search_listings` | Search active for-sale listings by location + filters (price SEK, rooms, m², property type, keywords). |
| `hemnet_get_listing` | Full detail for one listing (price, fee, running costs, m², rooms, tenure, energy class, broker, description, photos). |
| `hemnet_get_listing_photos` | Just the gallery photo URLs. |
| `hemnet_search_sold` | Search **sold** listings with final price, asking price, and over/under-asking %. |
| `hemnet_get_sold_listing` | Full detail for one sold listing. |
| `hemnet_get_market_stats` | Median/average final price and price-per-m² for a location. |
| `hemnet_compare_listings` | Fetch several listings at once for side-by-side comparison. |
| `hemnet_get_by_address` | Resolve a free-text street address to a live listing. |
| `hemnet_calculate_mortgage` | Local Swedish monthly-cost calculator (interest + amortisation + fee, gross & after-tax). No network. |
| `hemnet_healthcheck` | Verify the Hemnet GraphQL endpoint is reachable, and report which transport served the probe (direct fetch or the browser bridge, with the bridge role/port). |

### Example flow

```
1. hemnet_autocomplete_location { query: "Vasastan" }
   → location_id 925970
2. hemnet_search_listings { location_ids: ["925970"], rooms_min: 2, price_max: 6000000 }
   → listing summaries
3. hemnet_get_market_stats { location_ids: ["925970"], housing_form_groups: ["APARTMENTS"] }
   → median final price, price-per-m²
4. hemnet_calculate_mortgage { price: 4695000, interest_rate: 3.9, monthly_fee: 2800 }
   → monthly cost, gross and after-tax
```

Or pass a free-text `location` to any search tool and it resolves the top
hit for you.

## Money & units

All output records use **numbers**: `price` / `final_price` /
`fee_monthly` in SEK, `living_area_sqm` / `land_area_sqm` in m², `rooms`
as a number. A derived `price_per_sqm` is always included when price and
living area allow it (even when Hemnet omits it, common on houses). The
original Hemnet-formatted strings are kept alongside as `*_formatted`.

## Library use

hemnet-mcp is also importable, so it can serve as a Hemnet *portal
source* inside a larger project (e.g. a cross-portal realty
orchestrator):

```ts
import { createHemnetClient, computeMarketStats } from 'hemnet-mcp';

const hemnet = createHemnetClient();
const { cards } = await hemnet.searchSales({ locationIds: ['925970'] }, { limit: 50 });
const stats = computeMarketStats(cards.map(formatSaleCard));
```

The library entry (`import … from 'hemnet-mcp'`) re-exports the client,
the normalised record types, the pure derivations
(`computeMarketStats`, `calculateSwedishMortgage`, money/url helpers),
and every tool registrar (`registerHemnetTools(server, client)` to graft
the tools onto your own MCP server).

## Development

```bash
npm test               # vitest (mocked transport, no network)
npm run test:coverage  # 100% coverage enforced on src/**
npm run typecheck
npm run build
```

Tests drive every tool and the client through an in-memory fake
transport — no live hemnet.se calls. See `CLAUDE.md` for architecture,
the GraphQL quirks, and contribution conventions.

## License

MIT
