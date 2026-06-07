import type { CrashGroup, ExplorerContextPackage, RelatedHistoryItem } from '@agent-train/shared';
import { computeFilesOverlap, computeTimingScore } from '@agent-train/shared';
import { generateText, stepCountIs, type ToolSet } from 'ai';
import {
  assertWithinBudget,
  recordUsage,
  usageFromAiSdk,
  type CostAccumulator,
} from './cost.js';
import { buildMockExplorerPackage } from './explorer-mock.js';
import {
  extractExplorerContext,
  extractExplorerContextFallback,
} from './explorer-extract.js';
import { modelFor, modelIdFor, type LlmConfig } from './llm.js';
import type { ExplorerMode } from './types.js';
import { listRecentPrsTouchingFiles } from './tools/github.js';

export interface ExplorerInput {
  crashGroup: CrashGroup;
  githubRepo: string;
  githubToken?: string;
  stackSummary: string;
  relatedHistory: RelatedHistoryItem[];
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
      input.relatedHistory,
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
    stopWhen: stepCountIs(12),
    system: `You are an Explorer agent. Locate the crashing symbol and files for a mobile app crash.
Use available tools to search code, fetch crash details, and list recent PRs touching relevant files.
Return findings via tool calls. Do not produce the final RCA report — only gather context.`,
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
          relatedHistory: input.relatedHistory,
        }),
      },
    ],
  });

  recordUsage(input.cost, modelRef, usageFromAiSdk(result.usage));
  assertWithinBudget(input.cost);

  const steps = (result.steps ?? []) as unknown[];

  try {
    let pkg = await extractExplorerContext({
      crashGroupId: input.crashGroup.id,
      toolSteps: steps,
      explorerText: result.text,
      relatedHistory: input.relatedHistory,
      stackSummary: input.stackSummary,
      llm: input.llm,
      cost: input.cost,
    });

    pkg = await augmentWithGithubPrs(pkg, input);
    return enrichPrTiming(pkg, input.crashGroup);
  } catch (err) {
    console.warn('[explorer] Structured extraction failed, using fallback:', err);
    const file = extractFileFromCrash(input.crashGroup);
    const fallback = extractExplorerContextFallback({
      crashGroupId: input.crashGroup.id,
      file,
      symbol: input.crashGroup.title,
      githubRepo: input.githubRepo,
      stackSummary: input.stackSummary,
      relatedHistory: input.relatedHistory,
      unknowns: ['Explorer extraction failed — partial context only'],
    });
    const augmented = await augmentWithGithubPrs(fallback, input);
    return enrichPrTiming(augmented, input.crashGroup);
  }
}

async function augmentWithGithubPrs(
  pkg: ExplorerContextPackage,
  input: ExplorerInput,
): Promise<ExplorerContextPackage> {
  if (pkg.recentPrs.length > 0 || !input.githubToken) return pkg;

  const files = pkg.filesTouched.length > 0 ? pkg.filesTouched : [extractFileFromCrash(input.crashGroup)];

  try {
    const prs = await listRecentPrsTouchingFiles(
      input.githubToken,
      input.githubRepo,
      files,
      14,
    );
    return {
      ...pkg,
      recentPrs: prs.map((pr) => ({
        repo: pr.repo,
        number: pr.number,
        title: pr.title,
        mergedAt: pr.mergedAt,
        filesOverlap: computeFilesOverlap(pr.files, files),
      })),
    };
  } catch (err) {
    console.warn('[explorer] GitHub PR lookup failed:', err);
    return {
      ...pkg,
      unknowns: [...pkg.unknowns, 'GitHub PR lookup failed'],
    };
  }
}

function enrichPrTiming(
  pkg: ExplorerContextPackage,
  crashGroup: CrashGroup,
): ExplorerContextPackage {
  return {
    ...pkg,
    recentPrs: pkg.recentPrs.map((pr) => ({
      ...pr,
      timingScore: computeTimingScore(crashGroup.firstSeenVersion, pr.mergedAt),
      filesOverlap:
        pr.filesOverlap ??
        computeFilesOverlap(pkg.filesTouched, pkg.filesTouched),
    })),
  };
}

function extractFileFromCrash(crash: CrashGroup): string {
  const match = crash.signature.match(/([A-Za-z0-9_]+\.swift)/);
  return match?.[1] ?? 'Unknown.swift';
}
