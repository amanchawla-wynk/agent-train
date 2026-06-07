import {
  BudgetExceededError,
  buildAgentRuntimeConfig,
  runRca,
} from '@agent-train/agents';
import type { ServerConfig } from '../config.js';
import { getAppConfig } from '../config.js';
import type { CrashlyticsProvider } from '../crashlytics/types.js';
import { insertEdges } from '../db/edges.js';
import { updateRun } from '../db/rca.js';
import { AppNotFoundError, fetchRankedCrashGroups } from '../services/crashGroups.js';
import { prepareRcaInput } from '../services/rcaInput.js';

interface RcaJob {
  runId: string;
  crashGroupId: string;
  appId: string;
  days: number;
}

const queue: RcaJob[] = [];
let processing = false;

export function enqueueRcaJob(job: RcaJob): void {
  queue.push(job);
  void drainQueue();
}

async function drainQueue(): Promise<void> {
  if (processing) return;
  processing = true;

  while (queue.length > 0) {
    const job = queue.shift()!;
    await processJob(job);
  }

  processing = false;
}

async function processJob(job: RcaJob): Promise<void> {
  const config = workerConfig;
  const provider = workerProvider;
  if (!config || !provider) {
    await updateRun(job.runId, {
      status: 'failed',
      error: 'RCA worker not initialized',
      completedAt: new Date().toISOString(),
    });
    return;
  }

  await updateRun(job.runId, { status: 'running' });

  try {
    const app = getAppConfig(config, job.appId);
    if (!app) throw new AppNotFoundError(job.appId);

    const groups = await fetchRankedCrashGroups(provider, config, job.appId, job.days);
    const crashGroup = groups.find((g) => g.id === job.crashGroupId);
    if (!crashGroup) {
      throw new Error(`Crash group not found: ${job.crashGroupId}`);
    }

    const agentConfig = buildAgentRuntimeConfig({
      llm: config.llm,
      maxBudgetUsd: config.rcaMaxBudgetUsd,
      githubToken: config.githubToken,
      serenaMcpCommand: config.serenaMcpCommand,
      serenaMcpArgs: config.serenaMcpArgs,
      serenaRepoPath: config.serenaRepoPath,
    });

    const input = await prepareRcaInput(crashGroup, app, config);
    const result = await runRca(input, agentConfig, job.runId, {
      onProgress: (partial) => {
        void updateRun(job.runId, {
          runLog: {
            runId: job.runId,
            explorerModel: '',
            synthesisModel: '',
            inputTokens: 0,
            outputTokens: 0,
            costUsd: 0,
            budgetOk: true,
            durationMs: 0,
            explorerMode: partial.explorerMode ?? 'mock',
            integrationLevel: partial.integrationLevel ?? 'minimal',
            skillVersion: 'rca-skill-v2',
            phases: partial.phases ?? [],
          },
        });
      },
    });

    if (config.databaseUrl) {
      await insertEdges(result.edges);
    }

    await updateRun(job.runId, {
      status: 'completed',
      report: result.report,
      runLog: result.runLog,
      completedAt: new Date().toISOString(),
    });

    console.log('[rca] run complete', result.runLog);
  } catch (err) {
    const isBudget = err instanceof BudgetExceededError;
    await updateRun(job.runId, {
      status: isBudget ? 'budget_exceeded' : 'failed',
      error: err instanceof Error ? err.message : 'RCA failed',
      completedAt: new Date().toISOString(),
    });
    console.error('[rca] failed:', err);
  }
}

let workerConfig: ServerConfig | null = null;
let workerProvider: CrashlyticsProvider | null = null;

export function initRcaWorker(
  config: ServerConfig,
  provider: CrashlyticsProvider,
): void {
  workerConfig = config;
  workerProvider = provider;
}
