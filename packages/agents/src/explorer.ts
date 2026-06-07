import type { CrashGroup, ExplorerContextPackage } from '@agent-train/shared';
import { ExplorerContextPackageSchema } from '@agent-train/shared';
import { generateText, stepCountIs, type ToolSet } from 'ai';
import {
  assertWithinBudget,
  recordUsage,
  usageFromAiSdk,
  type CostAccumulator,
} from './cost.js';
import { buildMockExplorerPackage } from './explorer-mock.js';
import { modelFor, modelIdFor, type LlmConfig } from './llm.js';
import type { ExplorerMode } from './types.js';
import { listRecentPrsTouchingFiles } from './tools/github.js';

export interface ExplorerInput {
  crashGroup: CrashGroup;
  githubRepo: string;
  githubToken?: string;
  stackSummary?: string;
  serenaTools: ToolSet;
  firebaseTools: ToolSet;
  githubTools: ToolSet;
  mode: ExplorerMode;
  llm: LlmConfig;
  cost: CostAccumulator;
}

export async function runExplorer(input: ExplorerInput): Promise<ExplorerContextPackage> {
  if (input.mode === 'mock') {
    return buildMockExplorerPackage(
      input.crashGroup,
      input.githubRepo,
      input.stackSummary,
    );
  }

  const modelRef = modelIdFor('explorer', input.llm);
  const tools: ToolSet = {
    ...input.serenaTools,
    ...input.firebaseTools,
    ...input.githubTools,
  };

  const result = await generateText({
    model: modelFor('explorer', input.llm),
    tools,
    stopWhen: stepCountIs(8),
    system: `You are an Explorer agent. Locate the crashing symbol and files for a mobile app crash.
Return findings by using available tools. Focus on the crash signature and stack.
Do not produce the final RCA report — only gather context.`,
    messages: [
      {
        role: 'user',
        content: JSON.stringify({
          crashGroupId: input.crashGroup.id,
          title: input.crashGroup.title,
          signature: input.crashGroup.signature,
          app: input.crashGroup.app,
          version: input.crashGroup.latestVersion,
          stackSummary: input.stackSummary,
          githubRepo: input.githubRepo,
        }),
      },
    ],
  });

  recordUsage(input.cost, modelRef, usageFromAiSdk(result.usage));
  assertWithinBudget(input.cost);

  const file = extractFileFromCrash(input.crashGroup);
  let recentPrs: ExplorerContextPackage['recentPrs'] = [];

  if (input.githubToken) {
    try {
      const prs = await listRecentPrsTouchingFiles(
        input.githubToken,
        input.githubRepo,
        [file],
        14,
      );
      recentPrs = prs.map((pr) => ({
        repo: pr.repo,
        number: pr.number,
        title: pr.title,
        mergedAt: pr.mergedAt,
      }));
    } catch (err) {
      console.warn('[explorer] GitHub PR lookup failed:', err);
    }
  }

  const pkg: ExplorerContextPackage = {
    crashGroupId: input.crashGroup.id,
    filesTouched: [file],
    symbols: [
      {
        name: input.crashGroup.title,
        file,
        role: 'crashing',
      },
    ],
    recentPrs,
    stackSummary:
      input.stackSummary ??
      `${input.crashGroup.title} — ${input.crashGroup.signature}`,
    unknowns: result.text ? [] : ['Explorer produced no text summary'],
  };

  return ExplorerContextPackageSchema.parse(pkg);
}

function extractFileFromCrash(crash: CrashGroup): string {
  const match = crash.signature.match(/([A-Za-z0-9_]+\.swift)/);
  return match?.[1] ?? 'Unknown.swift';
}
