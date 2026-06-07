import { describe, expect, it } from 'vitest';
import {
  assertWithinBudget,
  BudgetExceededError,
  createCostAccumulator,
  estimateCostUsd,
  recordUsage,
} from './cost.js';

describe('cost tracking', () => {
  it('accumulates usage and cost', () => {
    const acc = createCostAccumulator(0.5);
    recordUsage(acc, 'google:gemini-2.0-flash', {
      inputTokens: 10_000,
      outputTokens: 2_000,
    });
    expect(acc.totalInputTokens).toBe(10_000);
    expect(acc.totalCostUsd).toBeGreaterThan(0);
    assertWithinBudget(acc);
  });

  it('throws when budget exceeded', () => {
    const acc = createCostAccumulator(0.000001);
    recordUsage(acc, 'openai:gpt-4o', {
      inputTokens: 100_000,
      outputTokens: 50_000,
    });
    expect(() => assertWithinBudget(acc)).toThrow(BudgetExceededError);
  });

  it('estimates cost for unknown models with fallback pricing', () => {
    const cost = estimateCostUsd('unknown:model', {
      inputTokens: 1_000_000,
      outputTokens: 1_000_000,
    });
    expect(cost).toBe(4);
  });
});
