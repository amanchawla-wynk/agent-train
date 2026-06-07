import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  derivePrdGapEdges,
  PrdGapReportBodySchema,
  type GraphEdge,
  type PrdDocument,
  type PrdGapReport,
} from '@agent-train/shared';
import { generateObject } from 'ai';
import {
  assertWithinBudget,
  createCostAccumulator,
  recordUsage,
  usageFromAiSdk,
} from './cost.js';
import { modelFor, modelIdFor } from './llm.js';
import {
  createPhaseTracker,
  logPhase,
  phaseCostDelta,
  snapshotCost,
  type RcaPhaseLog,
} from './orchestrator-phases.js';
import { fetchPrdDocument } from './prd-fetch.js';
import type { AgentRuntimeConfig, PrdGapInput } from './types.js';
import { createMockAtlassianTools } from './tools/atlassian-mock.js';
import { resolveAtlassianMcpConfig } from './tools/atlassian-mcp.js';
import { closeMcpClients, createMcpClients } from './tools/mcp.js';

const SKILL_VERSION = 'prd-gap-skill-v1';
const __dirname = dirname(fileURLToPath(import.meta.url));

export type PrdGapPhase = 'fetch' | 'analyze' | 'deriveEdges';

export interface PrdGapRunLog {
  runId: string;
  reviewModel: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  budgetOk: boolean;
  durationMs: number;
  atlassianMode: 'live' | 'mock';
  skillVersion: string;
  phases: RcaPhaseLog[];
}

export interface PrdGapResult {
  report: PrdGapReport;
  edges: GraphEdge[];
  runLog: PrdGapRunLog;
}

export interface PrdGapRunOptions {
  onProgress?: (partial: Pick<PrdGapRunLog, 'phases' | 'atlassianMode'>) => void;
}

async function loadSkill(): Promise<string> {
  const skillPath = join(__dirname, 'skills', `${SKILL_VERSION}.md`);
  return readFile(skillPath, 'utf-8');
}

export async function runPrdGapReview(
  input: PrdGapInput,
  config: AgentRuntimeConfig,
  runId = `prd-${Date.now()}`,
  options: PrdGapRunOptions = {},
): Promise<PrdGapResult> {
  const started = Date.now();
  const cost = createCostAccumulator(config.prdMaxBudgetUsd ?? config.maxBudgetUsd);
  const tracker = createPhaseTracker(runId);

  const mcpClients = await createMcpClients({
    atlassian: resolveAtlassianMcpConfig(),
  });

  const atlassianLive = Object.keys(mcpClients.atlassianTools).length > 0;
  const atlassianTools = atlassianLive
    ? mcpClients.atlassianTools
    : createMockAtlassianTools();
  const atlassianMode: 'live' | 'mock' = atlassianLive ? 'live' : 'mock';

  const emitProgress = () => {
    options.onProgress?.({
      phases: [...tracker.phases],
      atlassianMode,
    });
  };

  try {
    let phaseStart = Date.now();
    const fetchBefore = snapshotCost(cost);
    const document: PrdDocument = await fetchPrdDocument({
      prdId: input.prdId,
      document: input.document,
      atlassianTools,
    });
    logPhase(tracker, 'fetch', phaseStart, phaseCostDelta(cost, fetchBefore));
    emitProgress();

    phaseStart = Date.now();
    const analyzeBefore = snapshotCost(cost);
    const skill = await loadSkill();
    const reviewModelRef = modelIdFor('review', config.llm);

    const analysis = await generateObject({
      model: modelFor('review', config.llm),
      schema: PrdGapReportBodySchema,
      system: `${skill}\n\nAnalyze the PRD for gaps. Use prdId and prdTitle from the document.`,
      prompt: JSON.stringify({
        prdId: document.id,
        prdTitle: document.title,
        body: document.body,
      }),
    });

    recordUsage(cost, reviewModelRef, usageFromAiSdk(analysis.usage));
    assertWithinBudget(cost);

    const analyzeDelta = phaseCostDelta(cost, analyzeBefore);
    logPhase(tracker, 'analyze', phaseStart, {
      ...analyzeDelta,
      model: reviewModelRef,
    });
    emitProgress();

    const createdAt = new Date().toISOString();
    const report: PrdGapReport = {
      ...analysis.object,
      prdId: document.id,
      prdTitle: document.title,
      skillVersion: SKILL_VERSION,
      model: reviewModelRef,
      costUsd: cost.totalCostUsd,
      createdAt,
    };

    phaseStart = Date.now();
    const edges = derivePrdGapEdges(report, SKILL_VERSION, createdAt, runId);
    logPhase(tracker, 'deriveEdges', phaseStart);
    emitProgress();

    return {
      report,
      edges,
      runLog: {
        runId,
        reviewModel: reviewModelRef,
        inputTokens: cost.totalInputTokens,
        outputTokens: cost.totalOutputTokens,
        costUsd: cost.totalCostUsd,
        budgetOk: true,
        durationMs: Date.now() - started,
        atlassianMode,
        skillVersion: SKILL_VERSION,
        phases: tracker.phases,
      },
    };
  } finally {
    await closeMcpClients(mcpClients);
  }
}

export function buildPrdAgentRuntimeConfig(
  partial: Partial<AgentRuntimeConfig> & { llm: AgentRuntimeConfig['llm'] },
): AgentRuntimeConfig {
  return {
    maxBudgetUsd: Number(process.env.RCA_MAX_BUDGET_USD ?? 0.5),
    prdMaxBudgetUsd: Number(process.env.PRD_MAX_BUDGET_USD ?? 0.3),
    githubToken: process.env.GITHUB_TOKEN,
    serenaMcpCommand: process.env.SERENA_MCP_COMMAND,
    serenaMcpArgs: process.env.SERENA_MCP_ARGS?.split(',').filter(Boolean),
    serenaRepoPath: process.env.SERENA_REPO_PATH,
    ...partial,
  };
}
