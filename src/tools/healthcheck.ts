import type { McpServer } from '@modelcontextprotocol/server';
import { registerBridgeHealthcheckTool } from '@chrischall/mcp-utils/fetchproxy';
import type { HemnetClient } from '../client.js';
import { CloudflareChallengeError } from '../transport-direct.js';
import { BridgeHttpStatusError } from '../transport-fetchproxy.js';

/**
 * `hemnet_healthcheck` — one-call end-to-end probe of the Hemnet GraphQL
 * endpoint, built on the fleet's shared bridge healthcheck
 * (`registerBridgeHealthcheckTool`) in its direct-first shape.
 *
 * The probe is the client's tiny autocomplete round-trip, so it rides the
 * same transport the tools use — the default direct fetch with
 * browser-bridge fallback (see transport-fallback.ts). The result carries
 * `transport` (which leg served the probe + the configured
 * `HEMNET_TRANSPORT`), and once a bridge exists a `bridge` block with its
 * role / port / extension-link state (`session_state`,
 * `pending_pair_code`), plus a classified `error.kind` and a hint on
 * failure — so a failure isolates cleanly to network reachability,
 * Hemnet's Cloudflare wall, a bridge that never linked, or a Hemnet-side
 * change. Both `transport` and the bridge are read AFTER the probe: on
 * the default auto transport the probe itself is what flips the fallback.
 */
export function registerHealthcheckTools(
  server: McpServer,
  client: HemnetClient,
): void {
  registerBridgeHealthcheckTool({
    server,
    prefix: 'hemnet',
    probePath: '/graphql',
    hostLabel: 'www.hemnet.se',
    transport: () => client.bridgeTransport(),
    path: () => client.transportStatus() ?? { transport: 'unknown', mode: 'auto' },
    probeFn: async () => {
      const result = await client.healthcheck();
      // A 200 with no hits is a changed query or field, not a healthy
      // endpoint — the serialised body would be the same length either way.
      if (result.hits === 0) {
        throw new Error(
          'Hemnet answered, but the autocomplete probe for "Stockholm" returned 0 hits — the query or a field may have changed.',
        );
      }
      return JSON.stringify(result);
    },
    classifyThrown,
  });
}

const CLOUDFLARE_HINT =
  'Hemnet is serving a Cloudflare bot challenge. Set HEMNET_TRANSPORT=fetchproxy (or leave it at the default "auto"), keep a www.hemnet.se tab open (no login needed), and approve the ContextMint Bridge pairing prompt if one appears.';

/**
 * Site-specific classification of the probe's throw — only what the shared
 * ladder can't say on its own. Everything else is mcp-utils' own: since
 * 2.12 it unwraps a typed bridge failure that transport-fetchproxy.ts
 * re-throws as `cause` (so `session_not_ready` / `bridge_down` / `timeout` /
 * `capability_unavailable` keep their kinds and hints), and it names a
 * CDN/WAF refusal `edge_blocked` — the two arms this file used to hand-roll
 * (fleet-audit#1020).
 *
 *   - a `CloudflareChallengeError` — from the direct transport (only reaches
 *     here under `HEMNET_TRANSPORT=direct`; `auto` falls back instead) or as
 *     the bridge leg's non-JSON answer's `cause` → `cloudflare_challenge`
 *     with the Hemnet remediation (the documented kind for this server);
 *   - the bridge leg's non-2xx, typed `BridgeHttpStatusError` as `cause` —
 *     an upstream HTTP status, not a bridge fault → `http`.
 */
function classifyThrown(
  err: unknown,
): { kind: string; hint?: string } | undefined {
  const cause = err instanceof Error ? err.cause : undefined;
  if (err instanceof CloudflareChallengeError || cause instanceof CloudflareChallengeError) {
    return { kind: 'cloudflare_challenge', hint: CLOUDFLARE_HINT };
  }
  if (cause instanceof BridgeHttpStatusError) {
    return { kind: 'http' };
  }
  return undefined;
}
