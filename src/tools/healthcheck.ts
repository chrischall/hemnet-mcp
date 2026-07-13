import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { messageOf } from '@chrischall/mcp-utils';
import type { HemnetClient } from '../client.js';
import { textResult } from '../mcp.js';

/**
 * `hemnet_healthcheck` — one-call end-to-end probe of the Hemnet GraphQL
 * endpoint.
 *
 * Runs a tiny autocomplete round-trip and reports `ok`, the elapsed ms,
 * and a plain-English hint. Because hemnet-mcp talks to Hemnet directly
 * (no fetchproxy bridge, no browser session), a failure here isolates
 * cleanly to network reachability or a Hemnet-side change — call it when
 * a real tool errors and you want to know whether the endpoint is up.
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
        const walled = /Cloudflare|non-JSON|browser bridge/i.test(error);
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
