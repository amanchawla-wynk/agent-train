import type { CrashGroup, PrdDocument, RelatedHistoryItem, StackContext } from '@agent-train/shared';
import type { LlmConfig } from './llm.js';

export interface AppAgentConfig {
  id: string;
  githubRepo: string;
  firebaseProjectId?: string;
}

export interface AgentRuntimeConfig {
  llm: LlmConfig;
  maxBudgetUsd: number;
  prdMaxBudgetUsd?: number;
  githubToken?: string;
  serenaMcpCommand?: string;
  serenaMcpArgs?: string[];
  serenaRepoPath?: string;
}

export interface RcaInput {
  crashGroup: CrashGroup;
  app: AppAgentConfig;
  stackContext?: StackContext;
  relatedHistory?: RelatedHistoryItem[];
}

export interface PrdGapInput {
  prdId: string;
  document?: PrdDocument;
}

export type ExplorerMode = 'live' | 'mock';

export interface IntegrationStatus {
  serena: ExplorerMode;
  firebase: 'connected' | 'mock' | 'disconnected';
  github: 'configured' | 'missing';
  postgres: 'connected' | 'disconnected';
}
