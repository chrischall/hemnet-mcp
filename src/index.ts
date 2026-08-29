#!/usr/bin/env node
// hemnet-mcp entrypoint — standalone stdio MCP server for hemnet.se.
//
// Boot sequence:
//   1. Build the default GraphQL transport + HemnetClient. The default is
//      a direct anonymous `fetch` that automatically falls back to the
//      fetchproxy browser bridge if Hemnet's Cloudflare wall rejects it
//      (see transport-fallback.ts). `HEMNET_TRANSPORT` pins the mode.
//      Construction binds nothing — the bridge is only built if/when the
//      direct path is actually walled.
//   2. runMcp() builds the McpServer, applies the tool registrars with
//      the client as deps, prints the banner to stderr, wires graceful
//      shutdown, and connects the stdio transport.
//
// For embedding Hemnet into a larger server (realty-meta), import the
// registrars / client from 'hemnet-mcp' (src/lib.ts) instead of running
// this file.
import { runMcp } from '@chrischall/mcp-utils';
import { HemnetClient } from './client.js';
import { createDefaultTransport } from './transport-fallback.js';
import { registerHemnetTools } from './tools/index.js';

const VERSION = '0.4.0'; // x-release-please-version

const client = new HemnetClient({
  transport: createDefaultTransport({ version: VERSION }),
});

await runMcp({
  name: 'hemnet-mcp',
  version: VERSION,
  banner:
    `[hemnet-mcp] v${VERSION} — reads hemnet.se via its public GraphQL API ` +
    '(direct fetch, with browser-bridge fallback when Cloudflare-walled). ' +
    'This project was developed and is maintained by AI (Claude). ' +
    'Use at your own discretion and within hemnet.se\'s terms.',
  tools: [(server) => registerHemnetTools(server, client)],
});
