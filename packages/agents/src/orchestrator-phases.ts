import type { CostAccumulator } from './cost.js';

export type RcaPhase =
  | 'warmStart'
  | 'stackFetch'
  | 'explore'
  | 'extract'
  | 'verify'
  | 'synthesize'
  | 'deriveEdges'
  | 'fetch'
  | 'analyze';

export interface RcaPhaseLog {
  phase: RcaPhase;
  model?: string;
  inputTokens?: number;
  outputTokens?: number;
  costUsd?: number;
  durationMs: number;
}

export interface PhaseTracker {
  phases: RcaPhaseLog[];
  runId: string;
}

export function createPhaseTracker(runId: string): PhaseTracker {
  return { phases: [], runId };
}

export function logPhase(
  tracker: PhaseTracker,
  phase: RcaPhase,
  started: number,
  extra?: Partial<Omit<RcaPhaseLog, 'phase' | 'durationMs'>>,
): void {
  const entry: RcaPhaseLog = {
    phase,
    durationMs: Date.now() - started,
    ...extra,
  };
  tracker.phases.push(entry);
  console.log(
    JSON.stringify({
      runId: tracker.runId,
      phase: entry.phase,
      model: entry.model,
      tokens: entry.inputTokens != null ? { in: entry.inputTokens, out: entry.outputTokens } : undefined,
      costUsd: entry.costUsd,
      durationMs: entry.durationMs,
    }),
  );
}

export function snapshotCost(acc: CostAccumulator): {
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
} {
  return {
    inputTokens: acc.totalInputTokens,
    outputTokens: acc.totalOutputTokens,
    costUsd: acc.totalCostUsd,
  };
}

export function phaseCostDelta(
  acc: CostAccumulator,
  before: ReturnType<typeof snapshotCost>,
): { inputTokens: number; outputTokens: number; costUsd: number } {
  const after = snapshotCost(acc);
  return {
    inputTokens: after.inputTokens - before.inputTokens,
    outputTokens: after.outputTokens - before.outputTokens,
    costUsd: after.costUsd - before.costUsd,
  };
}
