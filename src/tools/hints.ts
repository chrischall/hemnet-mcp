/**
 * `_meta.mint` hints (the mcp-host context-groups contract): which canonical
 * group a tool belongs to, what kind of ask it answers, and everyday words
 * its name and description lack. Inert data to any other client.
 *
 * Hemnet is an anonymous property search with no account, so there is no
 * listable set of the person's subjects and every search needs a place the
 * person names: no tool is canonical, none declares `subject` or `when`.
 */
type MintIntent = 'lookup' | 'other';

interface MintHint {
  domain: 'home';
  intent: MintIntent;
  aliases?: string[];
}

/** A home-group hint with the given intent (and optional aliases). */
export function homeMeta(intent: MintIntent, aliases?: string[]): { mint: MintHint } {
  return { mint: aliases ? { domain: 'home', intent, aliases } : { domain: 'home', intent } };
}

/** What people say when they are house-hunting in Sweden. Lowercase, ≤ 8, each ≤ 40 chars. */
export const FOR_SALE_ALIASES = ['for sale', 'house hunting', 'apartment', 'bostad', 'lägenhet', 'villa', 'till salu'];

/** What people say when they ask what homes sold for. */
export const SOLD_ALIASES = ['sold price', 'what it sold for', 'slutpris', 'slutpriser', 'comps', 'house prices'];

/** What people say about a home loan. */
export const MORTGAGE_ALIASES = ['mortgage', 'home loan', 'bolån', 'monthly cost', 'amortization'];
