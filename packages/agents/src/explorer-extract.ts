import {
  ExplorerContextExtractSchema,
  type ExplorerContextPackage,
  type RelatedHistoryItem,
} from '@agent-train/shared';
import { generateObject } from 'ai';
import {
  assertWithinBudget,
  recordUsage,
  usageFromAiSdk,
  type CostAccumulator,
} from './cost.js';
import { modelFor, modelIdFor, type LlmConfig } from './llm.js';

export interface ToolStepSummary {
  toolName: string;
  input: unknown;
  output: unknown;
}

function serializeSteps(steps: unknown[]): string {
  const summaries: ToolStepSummary[] = [];

  for (const step of steps) {
    if (!step || typeof step !== 'object') continue;
    const s = step as {
      toolCalls?: Array<{ toolName: string; input: unknown }>;
      toolResults?: Array<{ toolName: string; output: unknown }>;
    };

    const calls = s.toolCalls ?? [];
    const results = s.toolResults ?? [];
    for (let i = 0; i < calls.length; i++) {
      summaries.push({
        toolName: calls[i].toolName,
        input: calls[i].input,
        output: results[i]?.output ?? null,
      });
    }
  }

  return JSON.stringify(summaries, null, 2);
}

export async function extractExplorerContext(input: {
  crashGroupId: string;
  toolSteps: unknown[];
  explorerText: string;
  relatedHistory: RelatedHistoryItem[];
  stackSummary: string;
  llm: LlmConfig;
  cost: CostAccumulator;
}): Promise<ExplorerContextPackage> {
  const modelRef = modelIdFor('explorer', input.llm);
  const before = input.cost.totalCostUsd;

  const extraction = await generateObject({
    model: modelFor('explorer', input.llm),
    schema: ExplorerContextExtractSchema,
    system: `Extract a structured explorer context package from tool call results.
Include files, symbols, recent PRs, dependencies, and a concise summary.
Do not invent PR numbers not present in tool outputs.`,
    prompt: JSON.stringify({
      explorerNotes: input.explorerText,
      toolSteps: serializeSteps(input.toolSteps),
      stackSummary: input.stackSummary,
      relatedHistory: input.relatedHistory,
    }),
  });

  recordUsage(input.cost, modelRef, usageFromAiSdk(extraction.usage));
  assertWithinBudget(input.cost);

  const mergedHistory = [
    ...input.relatedHistory,
    ...(extraction.object.relatedHistory ?? []),
  ];

  return {
    crashGroupId: input.crashGroupId,
    ...extraction.object,
    relatedHistory: mergedHistory,
    stackSummary: input.stackSummary,
    unknowns: extraction.object.unknowns ?? [],
  };
}

export function extractExplorerContextFallback(input: {
  crashGroupId: string;
  file: string;
  symbol: string;
  githubRepo: string;
  stackSummary: string;
  relatedHistory: RelatedHistoryItem[];
  unknowns: string[];
}): ExplorerContextPackage {
  return {
    crashGroupId: input.crashGroupId,
    filesTouched: [input.file],
    symbols: [{ name: input.symbol, file: input.file, role: 'crashing' }],
    recentPrs: [],
    dependencies: [],
    relatedHistory: input.relatedHistory,
    summary: `Crash in ${input.file}`,
    stackSummary: input.stackSummary,
    unknowns: input.unknowns,
  };
}
