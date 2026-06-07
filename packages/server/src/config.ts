import { config as loadEnv } from 'dotenv';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadLlmConfigFromEnv } from '@agent-train/agents';
import type { LlmConfig } from '@agent-train/agents';

const __dirname = dirname(fileURLToPath(import.meta.url));
loadEnv({ path: resolve(__dirname, '../../../.env') });

export interface AppConfig {
  id: string;
  bigQueryTable: string;
  githubRepo: string;
  firebaseProjectId?: string;
}

export interface ServerConfig {
  port: number;
  dataSource: 'mock' | 'bigquery';
  bigQueryProjectId: string;
  crashlyticsDataset: string;
  apps: AppConfig[];
  prdIds: string[];
  digestWebhookUrl: string;
  digestTopN: number;
  digestCron: string;
  databaseUrl: string;
  llm: LlmConfig;
  rcaMaxBudgetUsd: number;
  prdMaxBudgetUsd: number;
  githubToken?: string;
  serenaMcpCommand?: string;
  serenaMcpArgs?: string[];
  serenaRepoPath?: string;
}

function envKeyForApp(appId: string, suffix: string): string {
  return `APP_${appId.toUpperCase().replace(/[^A-Z0-9]/g, '_')}_${suffix}`;
}

function parseApps(): AppConfig[] {
  const appsRaw = process.env.APPS ?? 'ios_main,ios_beta';
  const appIds = appsRaw.split(',').map((s) => s.trim()).filter(Boolean);

  return appIds.map((id) => ({
    id,
    bigQueryTable: process.env[envKeyForApp(id, 'TABLE')] ?? `${id}_IOS`,
    githubRepo:
      process.env[envKeyForApp(id, 'GITHUB_REPO')] ?? `myorg/${id.replace(/_/g, '-')}`,
    firebaseProjectId: process.env[envKeyForApp(id, 'FIREBASE_PROJECT')],
  }));
}

function resolveDataSource(): 'mock' | 'bigquery' {
  const explicit = process.env.CRASHLYTICS_DATA_SOURCE;
  if (explicit === 'bigquery') return 'bigquery';
  if (explicit === 'mock') return 'mock';
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) return 'bigquery';
  return 'mock';
}

export function loadConfig(): ServerConfig {
  return {
    port: Number(process.env.PORT ?? 3001),
    dataSource: resolveDataSource(),
    bigQueryProjectId: process.env.BIGQUERY_PROJECT_ID ?? '',
    crashlyticsDataset: process.env.CRASHLYTICS_DATASET ?? 'firebase_crashlytics',
    apps: parseApps(),
    prdIds: (process.env.PRDS ?? 'playback-redesign,onboarding-v2')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
    digestWebhookUrl: process.env.DIGEST_WEBHOOK_URL ?? '',
    digestTopN: Number(process.env.DIGEST_TOP_N ?? 10),
    digestCron: process.env.DIGEST_CRON ?? '0 9 * * *',
    databaseUrl: process.env.DATABASE_URL ?? '',
    llm: loadLlmConfigFromEnv(),
    rcaMaxBudgetUsd: Number(process.env.RCA_MAX_BUDGET_USD ?? 0.5),
    prdMaxBudgetUsd: Number(process.env.PRD_MAX_BUDGET_USD ?? 0.3),
    githubToken: process.env.GITHUB_TOKEN,
    serenaMcpCommand: process.env.SERENA_MCP_COMMAND,
    serenaMcpArgs: process.env.SERENA_MCP_ARGS?.split(',').filter(Boolean),
    serenaRepoPath: process.env.SERENA_REPO_PATH,
  };
}

export function getAppConfig(config: ServerConfig, appId: string): AppConfig | undefined {
  return config.apps.find((a) => a.id === appId);
}
