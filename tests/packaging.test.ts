import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

// Claude Code reads a plugin's MCP config from `mcpServers`; an `mcp` key
// is silently ignored (`claude plugin validate`: "Unknown field 'mcp'").
describe('plugin packaging', () => {
  const plugin = JSON.parse(
    readFileSync(join(root, '.claude-plugin', 'plugin.json'), 'utf8'),
  ) as Record<string, unknown>;

  it('declares the MCP config under mcpServers, not mcp', () => {
    expect(plugin).not.toHaveProperty('mcp');
    expect(plugin.mcpServers).toBe('./.mcp.json');
  });

  it('points mcpServers at a file that exists', () => {
    expect(existsSync(join(root, String(plugin.mcpServers)))).toBe(true);
  });
});
