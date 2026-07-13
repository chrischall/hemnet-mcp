import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { messageOf } from '@chrischall/mcp-utils';
import type { HemnetClient } from '../client.js';
import { textResult } from '../mcp.js';

/**
 * `hemnet_healthcheck` — one-call end-to-end probe of the Hemnet GraphQL
 * endpoint.
 *
 * Runs a tiny autocomplete round-trip and reports `ok`, the elapsed ms,
 * and a plain-English hint. Because the round-trip goes through the same
 * transport the tools use — the default direct fetch with browser-bridge
 * fallback (see transport-fallback.ts) — a failure isolates cleanly to
 * network reachability, Hemnet's Cloudflare wall, or a Hemnet-side change.
 * Call it when a real tool errors and you want to know whether the
 * endpoint is up and which path is in play.
 */
export function registerHealthcheckTools(
  server: McpServer,
  client: HemnetClient,
): void {
  server.registerTool(
    'hemnet_healthcheck',
    {
      title: 'Verify the Hemnet GraphQL endpoint',
      description:
        'Round-trips a tiny query to hemnet.se GraphQL and reports whether the endpoint is reachable, the elapsed time, and a hint. Read-only, no auth.',
      annotations: {
        title: 'Verify the Hemnet GraphQL endpoint',
        readOnlyHint: true,
        idempotentHint: true,
        openWorldHint: true,
      },
      inputSchema: {},
    },
    async () => {
      const start = Date.now();
      try {
        const result = await client.healthcheck();
        return textResult({
          ok: true,
          elapsed_ms: Date.now() - start,
          hits: result.hits,
          hint: 'Hemnet GraphQL endpoint is reachable and responding.',
        });
      } catch (err) {
        const error = messageOf(err);
        // Any Cloudflare-challenge or bridge-path failure gets the
        // browser-bridge remediation hint. `bridge` covers both the
        // "Hemnet bridge: …" wrapper (transport-fetchproxy.ts) and the
        // "… via browser bridge" HTTP/non-JSON messages.
        const walled = /Cloudflare|non-JSON|bridge/i.test(error);
        return textResult({
          ok: false,
          elapsed_ms: Date.now() - start,
          error,
          hint: walled
            ? 'Hemnet is serving a Cloudflare bot challenge. Set HEMNET_TRANSPORT=fetchproxy (or leave it at the default "auto"), keep a www.hemnet.se tab open (no login needed), and approve the Transporter pairing prompt if one appears.'
            : 'Hemnet GraphQL did not respond. Check network reachability; the endpoint or a queried field may have changed.',
        });
      }
    },
  );
}
