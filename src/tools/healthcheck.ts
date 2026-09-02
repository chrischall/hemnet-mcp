import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import {
  classifyBridgeError,
  registerBridgeHealthcheckTool,
} from '@chrischall/mcp-utils/fetchproxy';
import type { HemnetClient } from '../client.js';
import { CloudflareChallengeError } from '../transport-direct.js';

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
    probeFn: async () => JSON.stringify(await client.healthcheck()),
    classifyThrown,
  });
}

const CLOUDFLARE_HINT =
  'Hemnet is serving a Cloudflare bot challenge. Set HEMNET_TRANSPORT=fetchproxy (or leave it at the default "auto"), keep a www.hemnet.se tab open (no login needed), and approve the Transporter pairing prompt if one appears.';

/**
 * Site-specific classification of the probe's throw. Two cases the shared
 * ladder can't see on its own:
 *
 *   - a `CloudflareChallengeError` from the direct transport (only reaches
 *     here under `HEMNET_TRANSPORT=direct`; `auto` falls back instead) →
 *     `cloudflare_challenge` with the browser-bridge remediation;
 *   - a bridge failure, which transport-fetchproxy.ts re-throws as a
 *     prefixed plain `Error` with the typed fetchproxy error as `cause` —
 *     classify the cause so `session_not_ready` / `bridge_down` / `timeout`
 *     keep their kinds (and their hint-ladder arms) instead of `unknown`.
 */
function classifyThrown(
  err: unknown,
): { kind: string; hint?: string } | undefined {
  if (err instanceof CloudflareChallengeError) {
    return { kind: 'cloudflare_challenge', hint: CLOUDFLARE_HINT };
  }
  const cause = err instanceof Error ? err.cause : undefined;
  if (cause === undefined) return undefined;
  const kind = classifyBridgeError(cause);
  return kind === 'other' ? undefined : { kind };
}
