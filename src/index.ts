#!/usr/bin/env node
// hemnet-mcp entrypoint — standalone stdio MCP server for hemnet.se.
//
// Boot sequence:
//   1. Build the default direct-`fetch` GraphQL transport + HemnetClient.
//      Unlike the fetchproxy fleet members, Hemnet serves its read
//      queries anonymously, so there's no bridge to start and no browser
//      session to bootstrap — the client is ready immediately.
//   2. runMcp() builds the McpServer, applies the tool registrars with
//      the client as deps, prints the banner to stderr, wires graceful
//      shutdown, and connects the stdio transport.
//
// For embedding Hemnet into a larger server (realty-meta), import the
// registrars / client from 'hemnet-mcp' (src/lib.ts) instead of running
// this file.
import { runMcp } from '@chrischall/mcp-utils';
import { HemnetClient } from './client.js';
import { DirectTransport } from './transport-direct.js';
import { registerHemnetTools } from './tools/index.js';

const VERSION = '0.2.0'; // x-release-please-version

const client = new HemnetClient({
  transport: new DirectTransport({ version: VERSION }),
});

await runMcp({
  name: 'hemnet-mcp',
  version: VERSION,
  banner:
    `[hemnet-mcp] v${VERSION} — reads hemnet.se via its public GraphQL API ` +
    '(direct fetch, no auth). This project was developed and is maintained by AI (Claude). ' +
    'Use at your own discretion and within hemnet.se\'s terms.',
  tools: [(server) => registerHemnetTools(server, client)],
});
