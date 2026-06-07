import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { McpServerConfig } from './mcp.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

function findFirebaseBinary(): string | undefined {
  const candidates = [
    join(__dirname, '../../node_modules/.bin/firebase'),
    join(process.cwd(), 'node_modules/.bin/firebase'),
    join(process.cwd(), 'packages/agents/node_modules/.bin/firebase'),
  ];

  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }
  return undefined;
}

export function resolveFirebaseMcpConfig(): McpServerConfig | undefined {
  const explicitCommand = process.env.FIREBASE_MCP_COMMAND?.trim();
  const enabled = process.env.FIREBASE_MCP_ENABLED === 'true';

  if (!enabled && !explicitCommand) {
    return undefined;
  }

  if (explicitCommand === 'npx') {
    console.warn(
      '[mcp] FIREBASE_MCP_COMMAND=npx is deprecated (spawns npm and causes warnings). ' +
        'Set FIREBASE_MCP_ENABLED=true and install firebase-tools, or set FIREBASE_MCP_COMMAND to the firebase binary path.',
    );
    return undefined;
  }

  if (explicitCommand) {
    return {
      name: 'firebase',
      command: explicitCommand,
      args: process.env.FIREBASE_MCP_ARGS?.split(',').map((s) => s.trim()).filter(Boolean) ?? [
        'mcp',
      ],
    };
  }

  const binary = findFirebaseBinary();
  if (!binary) {
    console.warn(
      '[mcp] FIREBASE_MCP_ENABLED=true but firebase-tools is not installed; using mock Firebase tools',
    );
    return undefined;
  }

  return {
    name: 'firebase',
    command: binary,
    args: ['mcp'],
  };
}
