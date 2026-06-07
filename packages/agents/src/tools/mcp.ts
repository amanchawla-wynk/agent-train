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
  atlassian: MCPClient | null;
  serenaTools: ToolSet;
  firebaseTools: ToolSet;
  atlassianTools: ToolSet;
}

const MCP_CONNECT_TIMEOUT_MS = 5000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`MCP connect timed out after ${ms}ms`)), ms);
    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

async function connectMcpServerOnce(config: McpServerConfig): Promise<MCPClient> {
  return withTimeout(
    createMCPClient({
      transport: new Experimental_StdioMCPTransport({
        command: config.command,
        args: config.args ?? [],
        env: sanitizeSubprocessEnv(config.env),
      }),
    }),
    MCP_CONNECT_TIMEOUT_MS,
  );
}

async function connectMcpServer(config: McpServerConfig): Promise<MCPClient | null> {
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      return await connectMcpServerOnce(config);
    } catch (err) {
      console.warn(`[mcp] Failed to connect ${config.name} (attempt ${attempt}):`, err);
      if (attempt === 2) return null;
    }
  }
  return null;
}

export async function createMcpClients(options: {
  serena?: McpServerConfig;
  firebase?: McpServerConfig;
  atlassian?: McpServerConfig;
}): Promise<McpClients> {
  const serena = options.serena ? await connectMcpServer(options.serena) : null;
  const firebase = options.firebase ? await connectMcpServer(options.firebase) : null;
  const atlassian = options.atlassian ? await connectMcpServer(options.atlassian) : null;

  const serenaTools = (serena ? await serena.tools() : {}) as ToolSet;
  const firebaseTools = (firebase ? await firebase.tools() : {}) as ToolSet;
  const atlassianTools = (atlassian ? await atlassian.tools() : {}) as ToolSet;

  return { serena, firebase, atlassian, serenaTools, firebaseTools, atlassianTools };
}

export async function closeMcpClients(clients: McpClients): Promise<void> {
  await Promise.all([
    clients.serena?.close(),
    clients.firebase?.close(),
    clients.atlassian?.close(),
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
