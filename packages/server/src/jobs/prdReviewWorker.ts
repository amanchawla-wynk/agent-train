import {
  BudgetExceededError,
  buildPrdAgentRuntimeConfig,
  runPrdGapReview,
} from '@agent-train/agents';
import type { ServerConfig } from '../config.js';
import { insertEdges } from '../db/edges.js';
import { updatePrdReviewRun } from '../db/prdReview.js';
import { loadPrdFixture } from '../services/prdFixtures.js';

interface PrdReviewJob {
  runId: string;
  prdId: string;
}

const queue: PrdReviewJob[] = [];
let processing = false;

export function enqueuePrdReviewJob(job: PrdReviewJob): void {
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

async function processJob(job: PrdReviewJob): Promise<void> {
  const config = workerConfig;
  if (!config) {
    await updatePrdReviewRun(job.runId, {
      status: 'failed',
      error: 'PRD review worker not initialized',
      completedAt: new Date().toISOString(),
    });
    return;
  }

  await updatePrdReviewRun(job.runId, { status: 'running' });

  try {
    const document = await loadPrdFixture(job.prdId);
    if (!document) {
      throw new Error(`PRD not found: ${job.prdId}`);
    }

    const agentConfig = buildPrdAgentRuntimeConfig({
      llm: config.llm,
      maxBudgetUsd: config.rcaMaxBudgetUsd,
      prdMaxBudgetUsd: config.prdMaxBudgetUsd,
    });

    const result = await runPrdGapReview(
      { prdId: job.prdId, document },
      agentConfig,
      job.runId,
      {
        onProgress: (partial) => {
          void updatePrdReviewRun(job.runId, {
            runLog: {
              runId: job.runId,
              reviewModel: '',
              inputTokens: 0,
              outputTokens: 0,
              costUsd: 0,
              budgetOk: true,
              durationMs: 0,
              atlassianMode: partial.atlassianMode ?? 'mock',
              skillVersion: 'prd-gap-skill-v1',
              phases: partial.phases ?? [],
            },
          });
        },
      },
    );

    if (config.databaseUrl) {
      await insertEdges(result.edges);
    }

    await updatePrdReviewRun(job.runId, {
      status: 'completed',
      report: result.report,
      runLog: result.runLog,
      completedAt: new Date().toISOString(),
    });

    console.log('[prd-review] run complete', result.runLog);
  } catch (err) {
    const isBudget = err instanceof BudgetExceededError;
    await updatePrdReviewRun(job.runId, {
      status: isBudget ? 'budget_exceeded' : 'failed',
      error: err instanceof Error ? err.message : 'PRD review failed',
      completedAt: new Date().toISOString(),
    });
    console.error('[prd-review] failed:', err);
  }
}

let workerConfig: ServerConfig | null = null;

export function initPrdReviewWorker(config: ServerConfig): void {
  workerConfig = config;
}
