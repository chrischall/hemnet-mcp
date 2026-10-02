/**
 * Direct-first transport with automatic browser-bridge fallback.
 *
 * Since 2026-07-13 Hemnet fronts www.hemnet.se with a Cloudflare managed
 * challenge that rejects non-browser clients (see transport-direct.ts /
 * transport-fetchproxy.ts). The direct fetch is still the preferred path
 * — it needs no extension, no pairing, no open tab — and Hemnet may drop
 * or scope the wall again. So: try direct; the moment it answers with a
 * challenge (`CloudflareChallengeError`), switch to the fetchproxy bridge
 * and stay there for the life of the process (the wall fingerprints the
 * client, so re-probing direct on every call would just burn a round
 * trip per request).
 *
 * `HEMNET_TRANSPORT` pins a mode: `direct` (fail hard when walled),
 * `fetchproxy` (always ride the tab), `auto` (this fallback — default).
 */
import {
  createDirectFirstTransport,
  readTransportMode,
  type BridgeHealthcheckTransport,
  type DirectFirstTransport,
} from '@chrischall/mcp-utils/fetchproxy';
import type {
  GraphQLResponse,
  HemnetTransport,
  TransportStatus,
} from './transport.js';
import { DirectTransport } from './transport-direct.js';
import type { DirectTransportOptions } from './transport-direct.js';
import { HemnetFetchproxyTransport } from './transport-fetchproxy.js';

/**
 * The `auto` router, as a {@link HemnetTransport}. The routing itself — try
 * direct, switch to the bridge on the first CDN/WAF refusal (any
 * `EdgeBlockedError`, which `CloudflareChallengeError` is), re-run that call
 * there, stay there, build the bridge once — is mcp-utils'
 * `createDirectFirstTransport` (fleet-audit#1020); this class only adapts
 * it to the one-method transport interface and keeps the constructor
 * library consumers already call.
 */
export class FallbackTransport implements HemnetTransport {
  private readonly legs: DirectFirstTransport<HemnetTransport, HemnetTransport>;

  constructor(direct: HemnetTransport, bridgeFactory: () => HemnetTransport) {
    this.legs = createDirectFirstTransport<HemnetTransport>({
      direct,
      bridge: bridgeFactory,
      mode: 'auto',
      serverName: 'hemnet-mcp',
      hostLabel: 'www.hemnet.se (no login needed)',
    });
  }

  graphql<T>(
    query: string,
    variables: Record<string, unknown>,
  ): Promise<GraphQLResponse<T>> {
    return this.legs.run((leg) => leg.graphql<T>(query, variables));
  }

  /**
   * The path the next request rides, `mode: 'auto'` (so a reader can tell
   * "on the bridge by fallback" from "pinned"), and `blocked_by` once a
   * CDN/WAF refusal forced the switch.
   */
  status(): TransportStatus {
    return this.legs.status();
  }

  /** The bridge once the fallback has built it; `undefined` while direct. */
  bridgeTransport(): BridgeHealthcheckTransport | undefined {
    return this.legs.bridgeTransport();
  }
}

export interface DefaultTransportOptions extends DirectTransportOptions {
  /** Injected direct transport (tests). */
  direct?: HemnetTransport;
  /** Injected bridge factory (tests). */
  bridgeFactory?: () => HemnetTransport;
}

/**
 * Build the transport `index.ts` (and library consumers) should use:
 * mode from `HEMNET_TRANSPORT` (read by mcp-utils' `readTransportMode`:
 * case-insensitive; an unknown value warns to stderr and means `auto`),
 * defaulting to the direct-with-fallback combination above.
 *
 * `DefaultTransportOptions` extends `DirectTransportOptions`, so the
 * wire-level knobs (`endpoint`, `timeoutMs`, `maxRetries`, `fetchImpl`,
 * `version`) still flow through to the default direct transport exactly
 * as they did before the fallback existed — passing `{ endpoint }` (etc.)
 * keeps working.
 */
export function createDefaultTransport(
  opts: DefaultTransportOptions = {},
): HemnetTransport {
  const direct = opts.direct ?? new DirectTransport(opts);
  const bridgeFactory =
    opts.bridgeFactory ??
    (() => new HemnetFetchproxyTransport({ version: opts.version }));
  const mode = readTransportMode('HEMNET_TRANSPORT', {
    log: (message) => console.error(`[hemnet-mcp] ${message}`),
  });
  if (mode === 'direct') return direct;
  if (mode === 'fetchproxy') return bridgeFactory();
  return new FallbackTransport(direct, bridgeFactory);
}
