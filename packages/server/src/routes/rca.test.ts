import { describe, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';

vi.mock('@agent-train/agents', () => ({
  runRca: vi.fn().mockResolvedValue({
    report: {
      crashGroupId: 'regression-001',
      summary: 'Test summary',
      likelyCause: 'Test cause',
      suspectPrs: [],
      confidence: 0.8,
      evidence: [],
      skillVersion: 'rca-skill-v1',
      model: 'openai:gpt-4o',
      costUsd: 0.01,
      createdAt: '2026-06-05T12:00:00.000Z',
    },
    edges: [],
    runLog: {
      runId: 'rca-1',
      explorerModel: 'google:gemini-2.0-flash',
      synthesisModel: 'openai:gpt-4o',
      inputTokens: 100,
      outputTokens: 50,
      costUsd: 0.01,
      budgetOk: true,
      durationMs: 1000,
      explorerMode: 'mock',
    },
  }),
  buildAgentRuntimeConfig: vi.fn().mockReturnValue({}),
  appAgentConfigFromApp: vi.fn().mockReturnValue({}),
  BudgetExceededError: class BudgetExceededError extends Error {},
  loadLlmConfigFromEnv: vi.fn(),
}));

vi.mock('../db/edges.js', () => ({
  insertEdges: vi.fn().mockResolvedValue(undefined),
}));

import { createRcaRouter } from './rca.js';
import type { ServerConfig } from '../config.js';
import { MockCrashlyticsProvider } from '../crashlytics/mock.js';

const config: ServerConfig = {
  port: 3001,
  dataSource: 'mock',
  bigQueryProjectId: '',
  crashlyticsDataset: 'firebase_crashlytics',
  apps: [
    {
      id: 'ios_main',
      bigQueryTable: 'ios_main_IOS',
      githubRepo: 'myorg/ios-app',
    },
  ],
  digestWebhookUrl: '',
  digestTopN: 10,
  digestCron: '0 9 * * *',
  databaseUrl: '',
  llm: {
    explorerModel: 'google:gemini-2.0-flash',
    synthesisModel: 'openai:gpt-4o',
  },
  rcaMaxBudgetUsd: 0.5,
};

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/rca', createRcaRouter(config, new MockCrashlyticsProvider()));
  return app;
}

describe('POST /api/rca', () => {
  it('returns 400 when body is incomplete', async () => {
    const res = await request(createApp()).post('/api/rca').send({});
    expect(res.status).toBe(400);
  });

  it('returns RCA report for valid crash group', async () => {
    const res = await request(createApp())
      .post('/api/rca')
      .send({ crashGroupId: 'regression-001', appId: 'ios_main' });

    expect(res.status).toBe(200);
    expect(res.body.summary).toBe('Test summary');
    expect(res.body.skillVersion).toBe('rca-skill-v1');
  });
});
