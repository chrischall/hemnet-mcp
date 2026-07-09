// Test harness for hemnet-mcp.
//
// Re-exports the fleet's in-memory MCP harness (createTestHarness /
// parseToolResult / versionSyncTest) and adds a FakeTransport: a
// HemnetTransport whose `graphql` is driven by a handler keyed off the
// operation name in the query string. Every test drives tools + client
// through this fake — zero network.
export {
  createTestHarness,
  parseToolResult,
  versionSyncTest,
} from '@chrischall/mcp-utils/test';

import type {
  GraphQLResponse,
  HemnetTransport,
} from '../src/transport.js';
import { HemnetClient } from '../src/client.js';

/** Handler that maps a GraphQL (query, variables) to a response envelope. */
export type GraphqlHandler = (
  query: string,
  variables: Record<string, unknown>,
) => GraphQLResponse<unknown>;

/** Records every call the code under test made, for assertions. */
export interface FakeTransport extends HemnetTransport {
  calls: { query: string; variables: Record<string, unknown> }[];
}

/** Build a fake transport from a single handler. */
export function fakeTransport(handler: GraphqlHandler): FakeTransport {
  const calls: FakeTransport['calls'] = [];
  return {
    calls,
    async graphql<T>(query: string, variables: Record<string, unknown>) {
      calls.push({ query, variables });
      return handler(query, variables) as GraphQLResponse<T>;
    },
  };
}

/**
 * Route responses by operation name (the `query XxxName(` after the
 * leading `query` keyword). Pass a map from operation name → envelope (or
 * a function returning one). Unmapped operations return an empty error.
 */
export function routedTransport(routes: {
  [operation: string]:
    | GraphQLResponse<unknown>
    | ((variables: Record<string, unknown>) => GraphQLResponse<unknown>);
}): FakeTransport {
  return fakeTransport((query, variables) => {
    const match = query.match(/query\s+(\w+)/);
    const name = match?.[1] ?? '';
    const route = routes[name];
    if (route === undefined) {
      return { errors: [{ message: `no route for ${name}` }] };
    }
    return typeof route === 'function' ? route(variables) : route;
  });
}

/** A HemnetClient backed by the given handler. */
export function fakeClient(handler: GraphqlHandler): HemnetClient {
  return new HemnetClient({ transport: fakeTransport(handler) });
}

/** A HemnetClient backed by routed responses. */
export function routedClient(routes: Parameters<typeof routedTransport>[0]): HemnetClient {
  return new HemnetClient({ transport: routedTransport(routes) });
}
