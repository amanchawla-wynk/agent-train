import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  deriveEdgesFromReport,
  RcaReportBodySchema,
  type GraphEdge,
  type RcaReport,
  type RelatedHistoryItem,
} from '@agent-train/shared';
import { generateObject, type ToolSet } from 'ai';
import {
  assertWithinBudget,
  BudgetExceededError,
  createCostAccumulator,
  recordUsage,
  usageFromAiSdk,
} from './cost.js';
import { runExplorer } from './explorer.js';
import { resolveIntegrationLevel } from './integration-status.js';
import { modelFor, modelIdFor } from './llm.js';
import {
  createPhaseTracker,
  logPhase,
  phaseCostDelta,
  snapshotCost,
  type RcaPhaseLog,
} from './orchestrator-phases.js';
import { fetchStackContext } from './stack.js';
import type { AgentRuntimeConfig, AppAgentConfig, RcaInput } from './types.js';
import { createGithubTools } from './tools/github.js';
import { resolveFirebaseMcpConfig } from './tools/mcp-config.js';
import {
  closeMcpClients,
  createMcpClients,
  createMockFirebaseTools,
} from './tools/mcp.js';
import { verifyAndCleanReport, verifyExplorerContext } from './verify.js';

const SKILL_VERSION = 'rca-skill-v2';
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
  integrationLevel: 'full' | 'partial' | 'minimal';
  skillVersion: string;
  phases: RcaPhaseLog[];
}

async function loadSkill(): Promise<string> {
  const skillPath = join(__dirname, 'skills', `${SKILL_VERSION}.md`);
  return readFile(skillPath, 'utf-8');
}

async function synthesizeReport(input: {
  crash: RcaInput['crashGroup'];
  contextPackage: Awaited<ReturnType<typeof runExplorer>>;
  skill: string;
  llm: AgentRuntimeConfig['llm'];
  cost: ReturnType<typeof createCostAccumulator>;
}): Promise<{ object: import('@agent-train/shared').RcaReportBody; modelRef: string }> {
  const synthesisModelRef = modelIdFor('synthesis', input.llm);

  const attempt = async (repair: boolean) => {
    return generateObject({
      model: modelFor('synthesis', input.llm),
      schema: RcaReportBodySchema,
      system: `${input.skill}\n\nUse the explorer context package and crash metadata to produce the RCA report.${
        repair ? '\n\nPrevious attempt failed schema validation. Fix field types and required evidence.' : ''
      }`,
      prompt: JSON.stringify({
        crash: input.crash,
        explorerContext: input.contextPackage,
      }),
    });
  };

  let synthesis = await attempt(false);
  recordUsage(input.cost, synthesisModelRef, usageFromAiSdk(synthesis.usage));

  const parsed = RcaReportBodySchema.safeParse(synthesis.object);
  if (!parsed.success) {
    synthesis = await attempt(true);
    recordUsage(input.cost, synthesisModelRef, usageFromAiSdk(synthesis.usage));
  }

  return { object: synthesis.object, modelRef: synthesisModelRef };
}

export interface RcaRunOptions {
  onProgress?: (partial: Pick<RcaRunLog, 'phases' | 'integrationLevel' | 'explorerMode'>) => void;
}

export async function runRca(
  input: RcaInput,
  config: AgentRuntimeConfig,
  runId = `rca-${Date.now()}`,
  options: RcaRunOptions = {},
): Promise<RcaResult> {
  const started = Date.now();
  const cost = createCostAccumulator(config.maxBudgetUsd);
  const tracker = createPhaseTracker(runId);

  const serenaConfigured = Boolean(config.serenaMcpCommand);
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

  const firebaseLive = Object.keys(mcpClients.firebaseTools).length > 0;
  const firebaseTools = firebaseLive
    ? mcpClients.firebaseTools
    : createMockFirebaseTools();

  const githubTools: ToolSet = config.githubToken
    ? createGithubTools(config.githubToken, input.app.githubRepo)
    : {};

  const integration = resolveIntegrationLevel({
    serenaLive: serenaConfigured && Object.keys(mcpClients.serenaTools).length > 0,
    firebaseLive,
    githubConfigured: Boolean(config.githubToken),
  });

  const explorerMode: 'live' | 'mock' =
    integration.serena === 'live' ? 'live' : 'mock';

  const relatedHistory: RelatedHistoryItem[] = input.relatedHistory ?? [];

  const emitProgress = () => {
    options.onProgress?.({
      phases: [...tracker.phases],
      integrationLevel: integration.level,
      explorerMode,
    });
  };

  try {
    // warmStart
    let phaseStart = Date.now();
    const warmBefore = snapshotCost(cost);
    logPhase(tracker, 'warmStart', phaseStart, phaseCostDelta(cost, warmBefore));
    emitProgress();

    // stackFetch
    phaseStart = Date.now();
    const stackBefore = snapshotCost(cost);
    const stackContext = await fetchStackContext(
      input.crashGroup,
      firebaseTools,
      input.stackContext,
    );
    const stackDelta = phaseCostDelta(cost, stackBefore);
    logPhase(tracker, 'stackFetch', phaseStart, stackDelta);
    emitProgress();

    // explore
    phaseStart = Date.now();
    const exploreBefore = snapshotCost(cost);
    let contextPackage = await runExplorer({
      crashGroup: input.crashGroup,
      githubRepo: input.app.githubRepo,
      githubToken: config.githubToken,
      stackSummary: stackContext.stackSummary,
      relatedHistory,
      serenaTools: mcpClients.serenaTools,
      firebaseTools,
      githubTools,
      mode: explorerMode,
      llm: config.llm,
      cost,
    });
    const exploreDelta = phaseCostDelta(cost, exploreBefore);
    logPhase(tracker, 'explore', phaseStart, {
      ...exploreDelta,
      model: modelIdFor('explorer', config.llm),
    });
    emitProgress();

    assertWithinBudget(cost);

    // extract (included in explore phase for live; log separately for observability)
    phaseStart = Date.now();
    logPhase(tracker, 'extract', phaseStart);
    emitProgress();

    // verify
    phaseStart = Date.now();
    const verifyResult = await verifyExplorerContext(
      contextPackage,
      input.crashGroup,
      config.githubToken,
    );
    contextPackage = verifyResult.contextPackage;
    logPhase(tracker, 'verify', phaseStart);
    emitProgress();

    assertWithinBudget(cost);

    // synthesize
    phaseStart = Date.now();
    const synthBefore = snapshotCost(cost);
    const skill = await loadSkill();
    const { object: rawReport, modelRef: synthesisModelRef } = await synthesizeReport({
      crash: input.crashGroup,
      contextPackage,
      skill,
      llm: config.llm,
      cost,
    });

    const cleaned = verifyAndCleanReport(rawReport, contextPackage);
    const synthDelta = phaseCostDelta(cost, synthBefore);
    logPhase(tracker, 'synthesize', phaseStart, {
      ...synthDelta,
      model: synthesisModelRef,
    });
    emitProgress();

    assertWithinBudget(cost);

    const createdAt = new Date().toISOString();
    const report: RcaReport = {
      ...cleaned,
      skillVersion: SKILL_VERSION,
      model: synthesisModelRef,
      costUsd: cost.totalCostUsd,
      createdAt,
    };

    // deriveEdges
    phaseStart = Date.now();
    const edges = deriveEdgesFromReport(report, SKILL_VERSION, createdAt, runId);
    logPhase(tracker, 'deriveEdges', phaseStart);
    emitProgress();

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
        explorerMode,
        integrationLevel: integration.level,
        skillVersion: SKILL_VERSION,
        phases: tracker.phases,
      },
    };
  } catch (err) {
    if (err instanceof BudgetExceededError) {
      throw err;
    }
    throw err;
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
