import { describe, it, expect } from 'vitest';
import { isReadOnlyOperation } from '../src/transport-fetchproxy.js';

describe('isReadOnlyOperation', () => {
  it.each([
    ['named query', 'query X { x }'],
    ['anonymous query', 'query { x }'],
    ['shorthand selection set', '{ x }'],
    ['indented query', '\n  query X($a: Int!) { x(a: $a) }\n'],
    ['fragment before query', 'fragment F on T { a }\nquery Y { ...F }'],
    ['comment-prefixed query', '# fetch a listing\nquery X { x }'],
    ['comment-prefixed shorthand', '# hi\n# there\n{ x }'],
    ['BOM-prefixed query', '﻿query X { x }'],
    ['BOM + comment-prefixed query', '﻿  # note\n  query X { x }'],
    ['query with a "mutation" field and string', 'query X { mutation(s: "mutation {") { id } }'],
    ['comment containing mutation', '# mutation Old { m }\nquery X { x }'],
  ])('%s → read-only', (_label, doc) => {
    expect(isReadOnlyOperation(doc)).toBe(true);
  });

  it.each([
    ['named mutation', 'mutation SaveListing($id: ID!) { save(id: $id) }'],
    ['anonymous mutation', 'mutation { m }'],
    ['subscription', 'subscription S { s }'],
    ['fragment before mutation', 'fragment F on T { a }\nmutation M { m { ...F } }'],
    ['comment-prefixed mutation', '# save a listing\nmutation M { m }'],
    ['comment-prefixed mutation, no newline gap', '#c\nmutation{m}'],
    ['comment-prefixed subscription', '# live\nsubscription S { s }'],
    ['BOM + comment-prefixed mutation', '﻿# x\r\nmutation M { m }'],
    ['comment ending in a brace, then mutation', '# }\nmutation M { m }'],
    ['query followed by a mutation', 'query Q { q }\nmutation M { m }'],
    ['empty document', ''],
    ['comment-only document', '# nothing here'],
    ['unrecognised leading token', 'q'],
  ])('%s → NOT read-only', (_label, doc) => {
    expect(isReadOnlyOperation(doc)).toBe(false);
  });
});
