// Re-exports minifiedResult from @chrischall/mcp-utils; tools import from ./mcp.js
// unchanged. Mirrors the fleet convention (see homes-mcp/src/mcp.ts) so the
// tool files never reach into the utils barrel directly.
export { minifiedResult } from '@chrischall/mcp-utils';
