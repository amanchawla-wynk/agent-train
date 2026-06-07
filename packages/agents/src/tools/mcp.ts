import { createMCPClient, type MCPClient } from '@ai-sdk/mcp';
import { Experimental_StdioMCPTransport } from '@ai-sdk/mcp/mcp-stdio';
import { tool, type ToolSet } from 'ai';
import { z } from 'zod';
import { sanitizeSubprocessEnv } from './mcp-env.js';

export interface McpServerConfig {
  name: string;
  command: string;
  args?: string[];
  env?: Record<string, string>;
}

export interface McpClients {
  serena: MCPClient | null;
  firebase: MCPClient | null;
  serenaTools: ToolSet;
  firebaseTools: ToolSet;
}

async function connectMcpServer(config: McpServerConfig): Promise<MCPClient | null> {
  try {
    const client = await createMCPClient({
      transport: new Experimental_StdioMCPTransport({
        command: config.command,
        args: config.args ?? [],
        env: sanitizeSubprocessEnv(config.env),
      }),
    });
    return client;
  } catch (err) {
    console.warn(`[mcp] Failed to connect ${config.name}:`, err);
    return null;
  }
}

export async function createMcpClients(options: {
  serena?: McpServerConfig;
  firebase?: McpServerConfig;
}): Promise<McpClients> {
  const serena = options.serena ? await connectMcpServer(options.serena) : null;
  const firebase = options.firebase ? await connectMcpServer(options.firebase) : null;

  const serenaTools = (serena ? await serena.tools() : {}) as ToolSet;
  const firebaseTools = (firebase ? await firebase.tools() : {}) as ToolSet;

  return { serena, firebase, serenaTools, firebaseTools };
}

export async function closeMcpClients(clients: McpClients): Promise<void> {
  await Promise.all([
    clients.serena?.close(),
    clients.firebase?.close(),
  ]);
}

export function createMockFirebaseTools(): ToolSet {
  const getCrashIssue = tool({
    description: 'Get Crashlytics issue details including stack trace (mock)',
    inputSchema: z.object({
      issueId: z.string(),
    }),
    execute: async ({ issueId }) => ({
      issueId,
      title: 'EXC_BAD_ACCESS in PlaybackController',
      stackTrace: 'PlaybackController.swift:142 - play()',
      frames: ['PlaybackController.swift:142', 'MovieRepository.swift:88'],
    }),
  });

  return { get_crash_issue: getCrashIssue };
}
