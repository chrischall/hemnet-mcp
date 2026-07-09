import { describe, it, expect } from 'vitest';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { versionSyncTest } from './helpers.js';

const here = dirname(fileURLToPath(import.meta.url));

// Release-please drift guard: the `VERSION` literal in src/index.ts
// (marked `x-release-please-version`) must match package.json#version.
describe('version sync', () => {
  it('keeps x-release-please-version literals in sync with package.json', () => {
    const mismatches = versionSyncTest({
      srcDir: join(here, '..', 'src'),
      pkgPath: join(here, '..', 'package.json'),
    });
    expect(mismatches).toEqual([]);
  });
});
