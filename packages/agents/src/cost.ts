export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
}

export interface CostAccumulator {
  maxBudgetUsd: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCostUsd: number;
}

/** Approximate USD per 1M tokens — override via env if needed. */
const DEFAULT_PRICING: Record<string, { input: number; output: number }> = {
  'google:gemini-2.0-flash': { input: 0.1, output: 0.4 },
  'google:gemini-2.5-flash': { input: 0.15, output: 0.6 },
  'openai:gpt-4o': { input: 2.5, output: 10 },
  'openai:gpt-4o-mini': { input: 0.15, output: 0.6 },
};

export function createCostAccumulator(maxBudgetUsd: number): CostAccumulator {
  return {
    maxBudgetUsd,
    totalInputTokens: 0,
    totalOutputTokens: 0,
    totalCostUsd: 0,
  };
}

export function estimateCostUsd(modelRef: string, usage: TokenUsage): number {
  const pricing = DEFAULT_PRICING[modelRef] ?? { input: 1, output: 3 };
  const inputCost = (usage.inputTokens / 1_000_000) * pricing.input;
  const outputCost = (usage.outputTokens / 1_000_000) * pricing.output;
  return inputCost + outputCost;
}

export function recordUsage(
  acc: CostAccumulator,
  modelRef: string,
  usage: TokenUsage,
): number {
  const stepCost = estimateCostUsd(modelRef, usage);
  acc.totalInputTokens += usage.inputTokens;
  acc.totalOutputTokens += usage.outputTokens;
  acc.totalCostUsd += stepCost;
  return stepCost;
}

export function assertWithinBudget(acc: CostAccumulator): void {
  if (acc.totalCostUsd >= acc.maxBudgetUsd) {
    throw new BudgetExceededError(acc.totalCostUsd, acc.maxBudgetUsd);
  }
}

export class BudgetExceededError extends Error {
  constructor(
    public readonly spentUsd: number,
    public readonly maxBudgetUsd: number,
  ) {
    super(`RCA budget exceeded: $${spentUsd.toFixed(4)} >= $${maxBudgetUsd.toFixed(2)}`);
    this.name = 'BudgetExceededError';
  }
}

export function usageFromAiSdk(usage?: {
  promptTokens?: number;
  completionTokens?: number;
  inputTokens?: number;
  outputTokens?: number;
}): TokenUsage {
  return {
    inputTokens: usage?.inputTokens ?? usage?.promptTokens ?? 0,
    outputTokens: usage?.outputTokens ?? usage?.completionTokens ?? 0,
  };
}
