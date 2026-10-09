import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createTestHarness, routedClient } from './helpers.js';
import { registerHemnetTools } from '../src/tools/index.js';

const here = dirname(fileURLToPath(import.meta.url));

/**
 * Fleet annotation meta-test, read off the REGISTERED surface (tools/list),
 * never a hand-kept list. `destructiveHint` defaults to TRUE whenever
 * `readOnlyHint` is false, so a write that forgets to declare it publishes
 * as destructive and nothing else fails; and a missing `openWorldHint`
 * defaults to true, which is wrong for the local mortgage calculator.
 */
interface Ann {
  readOnlyHint?: unknown;
  destructiveHint?: unknown;
  openWorldHint?: unknown;
}

let tools: { name: string; annotations?: Ann }[] = [];

beforeAll(async () => {
  const h = await createTestHarness((s) => registerHemnetTools(s, routedClient({})));
  // h.listTools() trims to name/description; the raw client keeps annotations.
  tools = (await h.client.listTools()).tools as typeof tools;
  await h.close();
});

describe('tool annotations', () => {
  it('covers the full surface (guards against a registrar being dropped)', () => {
    expect(tools).toHaveLength(11);
  });

  it('sets an explicit boolean readOnlyHint on every tool', () => {
    const missing = tools
      .filter((t) => typeof t.annotations?.readOnlyHint !== 'boolean')
      .map((t) => t.name);
    expect(missing).toEqual([]);
  });

  it('sets an explicit boolean destructiveHint on every write', () => {
    const undeclared = tools
      .filter(
        (t) =>
          t.annotations?.readOnlyHint === false &&
          typeof t.annotations?.destructiveHint !== 'boolean',
      )
      .map((t) => t.name);
    expect(undeclared).toEqual([]);
  });

  it('never lets a read claim to be destructive', () => {
    const contradictory = tools
      .filter(
        (t) => t.annotations?.readOnlyHint === true && t.annotations?.destructiveHint === true,
      )
      .map((t) => t.name);
    expect(contradictory).toEqual([]);
  });

  it('sets an explicit boolean openWorldHint on every tool', () => {
    const missing = tools
      .filter((t) => typeof t.annotations?.openWorldHint !== 'boolean')
      .map((t) => t.name);
    expect(missing).toEqual([]);
  });

  it('is entirely read-only, with only the local mortgage calculator closed-world', () => {
    // Every Hemnet tool is an anonymous GraphQL read (CLAUDE.md "Tool surface").
    expect(tools.filter((t) => t.annotations?.readOnlyHint !== true).map((t) => t.name)).toEqual([]);
    expect(
      tools.filter((t) => t.annotations?.openWorldHint === false).map((t) => t.name),
    ).toEqual(['hemnet_calculate_mortgage']);
  });
});

describe('manifest.json tools[]', () => {
  it('lists exactly the served tool names, in both directions', () => {
    const manifest = JSON.parse(readFileSync(join(here, '..', 'manifest.json'), 'utf8')) as {
      tools: { name: string }[];
    };
    const declared = manifest.tools.map((t) => t.name).sort();
    const served = tools.map((t) => t.name).sort();
    expect(declared).toEqual(served);
  });
});
