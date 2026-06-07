import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  deriveEdgesFromReport,
  RcaReportBodySchema,
  type GraphEdge,
  type RcaReport,
} from '@agent-train/shared';
import { generateObject, type ToolSet } from 'ai';
import {
  assertWithinBudget,
  createCostAccumulator,
  recordUsage,
  usageFromAiSdk,
} from './cost.js';
import { runExplorer } from './explorer.js';
import { modelFor, modelIdFor } from './llm.js';
import type { AgentRuntimeConfig, AppAgentConfig, RcaInput } from './types.js';
import { createGithubTools } from './tools/github.js';
import { resolveFirebaseMcpConfig } from './tools/mcp-config.js';
import {
  closeMcpClients,
  createMcpClients,
  createMockFirebaseTools,
} from './tools/mcp.js';

const SKILL_VERSION = 'rca-skill-v1';
const __dirname = dirname(fileURLToPath(import.meta.url));

export interface RcaResult {
  report: RcaReport;
  edges: GraphEdge[];
  runLog: RcaRunLog;
}

export interface RcaRunLog {
  runId: string;
  explorerModel: string;
  synthesisModel: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  budgetOk: boolean;
  durationMs: number;
  explorerMode: 'live' | 'mock';
}

async function loadSkill(): Promise<string> {
  const skillPath = join(__dirname, 'skills', `${SKILL_VERSION}.md`);
  return readFile(skillPath, 'utf-8');
}

export async function runRca(
  input: RcaInput,
  config: AgentRuntimeConfig,
): Promise<RcaResult> {
  const started = Date.now();
  const runId = `rca-${Date.now()}`;
  const cost = createCostAccumulator(config.maxBudgetUsd);

  const serenaConfigured = Boolean(config.serenaMcpCommand);
  const explorerMode = serenaConfigured ? 'live' : 'mock';

  const mcpClients = await createMcpClients({
    serena: serenaConfigured
      ? {
          name: 'serena',
          command: config.serenaMcpCommand!,
          args: config.serenaMcpArgs,
          env: config.serenaRepoPath
            ? { SERENA_REPO_PATH: config.serenaRepoPath }
            : undefined,
        }
      : undefined,
    firebase: resolveFirebaseMcpConfig(),
  });

  const firebaseTools =
    Object.keys(mcpClients.firebaseTools).length > 0
      ? mcpClients.firebaseTools
      : createMockFirebaseTools();

  const githubTools: ToolSet = config.githubToken
    ? createGithubTools(config.githubToken, input.app.githubRepo)
    : {};

  try {
    const contextPackage = await runExplorer({
      crashGroup: input.crashGroup,
      githubRepo: input.app.githubRepo,
      githubToken: config.githubToken,
      stackSummary: input.stackSummary,
      serenaTools: mcpClients.serenaTools,
      firebaseTools,
      githubTools,
      mode: explorerMode === 'live' && Object.keys(mcpClients.serenaTools).length === 0
        ? 'mock'
        : explorerMode,
      llm: config.llm,
      cost,
    });

    assertWithinBudget(cost);

    const skill = await loadSkill();
    const synthesisModelRef = modelIdFor('synthesis', config.llm);

    const synthesis = await generateObject({
      model: modelFor('synthesis', config.llm),
      schema: RcaReportBodySchema,
      system: `${skill}\n\nUse the explorer context package and crash metadata to produce the RCA report.`,
      prompt: JSON.stringify({
        crash: input.crashGroup,
        explorerContext: contextPackage,
      }),
    });

    recordUsage(cost, synthesisModelRef, usageFromAiSdk(synthesis.usage));
    assertWithinBudget(cost);

    const createdAt = new Date().toISOString();
    const report: RcaReport = {
      ...synthesis.object,
      skillVersion: SKILL_VERSION,
      model: synthesisModelRef,
      costUsd: cost.totalCostUsd,
      createdAt,
    };

    const edges = deriveEdgesFromReport(report, SKILL_VERSION, createdAt);

    return {
      report,
      edges,
      runLog: {
        runId,
        explorerModel: modelIdFor('explorer', config.llm),
        synthesisModel: synthesisModelRef,
        inputTokens: cost.totalInputTokens,
        outputTokens: cost.totalOutputTokens,
        costUsd: cost.totalCostUsd,
        budgetOk: true,
        durationMs: Date.now() - started,
        explorerMode:
          explorerMode === 'live' && Object.keys(mcpClients.serenaTools).length === 0
            ? 'mock'
            : explorerMode,
      },
    };
  } finally {
    await closeMcpClients(mcpClients);
  }
}

export function buildAgentRuntimeConfig(
  partial: Partial<AgentRuntimeConfig> & { llm: AgentRuntimeConfig['llm'] },
): AgentRuntimeConfig {
  return {
    maxBudgetUsd: Number(process.env.RCA_MAX_BUDGET_USD ?? 0.5),
    githubToken: process.env.GITHUB_TOKEN,
    serenaMcpCommand: process.env.SERENA_MCP_COMMAND,
    serenaMcpArgs: process.env.SERENA_MCP_ARGS?.split(',').filter(Boolean),
    serenaRepoPath: process.env.SERENA_REPO_PATH,
    ...partial,
  };
}

export function appAgentConfigFromApp(app: {
  id: string;
  githubRepo: string;
  firebaseProjectId?: string;
}): AppAgentConfig {
  return {
    id: app.id,
    githubRepo: app.githubRepo,
    firebaseProjectId: app.firebaseProjectId,
  };
}
