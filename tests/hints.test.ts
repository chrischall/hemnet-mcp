import { describe, it, expect, beforeAll } from 'vitest';
import { createTestHarness, routedClient } from './helpers.js';
import { registerHemnetTools } from '../src/tools/index.js';

/**
 * Context-group hints (`_meta.mint`, the mcp-host context-groups contract),
 * read off the served `tools/list` — what a host sees — never a hand-kept
 * list of registrars.
 *
 * Hemnet is an anonymous property search: there is no account, so there is
 * no listable set of the person's subjects (saved searches, homes) and every
 * search needs a location the person names. Nothing here answers a bare
 * "what's new / due / on?" without arguments, so no tool is canonical and
 * none declares `subject`, `when` or a brief view.
 */
type Mint = {
  domain?: string;
  intent?: string;
  canonical?: boolean;
  subject?: string;
  when?: { start: string; end: string };
  aliases?: string[];
};
type Listed = {
  name: string;
  annotations?: { readOnlyHint?: boolean };
  inputSchema: { properties?: Record<string, { enum?: unknown[] }> };
  _meta?: { mint?: Mint };
};

const DOMAINS = ['school', 'home', 'work', 'family', 'health', 'money', 'travel', 'food'];
const INTENTS = ['whats-new', 'whats-due', 'whats-on', 'lookup', 'turn-on-off', 'send', 'change', 'other'];
const KEYS = ['domain', 'intent', 'canonical', 'subject', 'when', 'aliases'];
const CANONICAL_INTENTS = ['whats-new', 'whats-due', 'whats-on'];

/** The intent every tool declares — this table is the assertion. */
const EXPECTED_INTENT: Record<string, string> = {
  hemnet_autocomplete_location: 'lookup',
  hemnet_search_listings: 'lookup',
  hemnet_get_listing: 'lookup',
  hemnet_get_listing_photos: 'lookup',
  hemnet_compare_listings: 'lookup',
  hemnet_get_by_address: 'lookup',
  hemnet_search_sold: 'lookup',
  hemnet_get_sold_listing: 'lookup',
  hemnet_get_market_stats: 'lookup',
  hemnet_calculate_mortgage: 'other',
};

let tools: Listed[] = [];
const hinted = () => tools.filter((t) => !t.name.endsWith('_healthcheck'));

beforeAll(async () => {
  const h = await createTestHarness((s) => registerHemnetTools(s, routedClient({})));
  // h.listTools() trims to name/description; the raw client keeps _meta.
  tools = (await h.client.listTools()).tools as Listed[];
  await h.close();
});

describe('_meta.mint on every served tool', () => {
  it('names every served tool but the healthcheck, so a new tool cannot skip the decision', () => {
    expect(hinted().map((t) => t.name).sort()).toEqual(Object.keys(EXPECTED_INTENT).sort());
    expect(tools.map((t) => t.name)).toContain('hemnet_healthcheck');
  });

  it.each(Object.entries(EXPECTED_INTENT))('%s declares domain home and intent %s', (name, intent) => {
    const mint = tools.find((t) => t.name === name)?._meta?.mint;
    expect(mint, name).toBeDefined();
    expect(Object.keys(mint!).every((k) => KEYS.includes(k)), name).toBe(true);
    expect(DOMAINS).toContain(mint!.domain);
    expect(mint!.domain).toBe('home');
    expect(INTENTS).toContain(mint!.intent);
    expect(mint!.intent).toBe(intent);
  });

  it('keeps aliases to the words a person says: ≤ 8, lowercase, ≤ 40 chars, never a tool name', () => {
    for (const t of hinted()) {
      const aliases = t._meta!.mint!.aliases ?? [];
      expect(aliases.length, t.name).toBeLessThanOrEqual(8);
      for (const a of aliases) {
        expect(a, t.name).toBe(a.toLowerCase());
        expect(a.length, t.name).toBeLessThanOrEqual(40);
        expect(a, t.name).not.toMatch(/^hemnet_/);
      }
    }
    expect(tools.find((t) => t.name === 'hemnet_search_listings')?._meta?.mint?.aliases).toContain('for sale');
    expect(tools.find((t) => t.name === 'hemnet_search_sold')?._meta?.mint?.aliases).toContain('slutpris');
  });

  it('names only arguments that exist when it declares subject or when', () => {
    for (const t of hinted()) {
      const m = t._meta!.mint!;
      const props = t.inputSchema.properties ?? {};
      if (m.subject) expect(props, t.name).toHaveProperty(m.subject);
      if (m.when) {
        expect(props, t.name).toHaveProperty(m.when.start);
        expect(props, t.name).toHaveProperty(m.when.end);
      }
    }
  });

  it('marks canonical only reads, only on what’s-new/due/on, at most one per intent', () => {
    const canonical = hinted().filter((t) => t._meta!.mint!.canonical !== undefined);
    for (const t of canonical) {
      expect(t._meta!.mint!.canonical, t.name).toBe(true);
      expect(t.annotations?.readOnlyHint, t.name).toBe(true);
      expect(CANONICAL_INTENTS, t.name).toContain(t._meta!.mint!.intent);
      expect(t.inputSchema.properties ?? {}, t.name).toHaveProperty('view');
    }
    for (const intent of CANONICAL_INTENTS) {
      expect(canonical.filter((t) => t._meta!.mint!.intent === intent).length, intent).toBeLessThanOrEqual(1);
    }
  });

  it('declares no canonical read, subject or range: every Hemnet ask needs a place the person names', () => {
    for (const t of hinted()) {
      const m = t._meta!.mint!;
      expect(m.canonical, t.name).toBeUndefined();
      expect(m.subject, t.name).toBeUndefined();
      expect(m.when, t.name).toBeUndefined();
    }
  });
});
