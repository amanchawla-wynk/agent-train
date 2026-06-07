import type { McpServerConfig } from './mcp.js';

export function resolveAtlassianMcpConfig(): McpServerConfig | undefined {
  const explicitCommand = process.env.ATLASSIAN_MCP_COMMAND?.trim();
  const enabled = process.env.ATLASSIAN_MCP_ENABLED === 'true';

  if (!enabled && !explicitCommand) {
    return undefined;
  }

  if (explicitCommand) {
    return {
      name: 'atlassian',
      command: explicitCommand,
      args: process.env.ATLASSIAN_MCP_ARGS?.split(',').map((s) => s.trim()).filter(Boolean),
    };
  }

  console.warn(
    '[mcp] ATLASSIAN_MCP_ENABLED=true but ATLASSIAN_MCP_COMMAND is not set; using mock Atlassian tools',
  );
  return undefined;
}
