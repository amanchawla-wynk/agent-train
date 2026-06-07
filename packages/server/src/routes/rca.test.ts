import { describe, expect, it, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

const runRcaMock = vi.fn();
const createRunMock = vi.fn();
const getRunMock = vi.fn();
const updateRunMock = vi.fn();
const enqueueMock = vi.fn();

vi.mock('@agent-train/agents', () => ({
  runRca: (...args: unknown[]) => runRcaMock(...args),
  buildAgentRuntimeConfig: vi.fn().mockReturnValue({}),
  appAgentConfigFromApp: vi.fn().mockReturnValue({}),
  BudgetExceededError: class BudgetExceededError extends Error {},
  loadLlmConfigFromEnv: vi.fn(),
  resolveIntegrationLevel: vi.fn().mockReturnValue({ level: 'minimal' }),
}));

vi.mock('../db/edges.js', () => ({
  insertEdges: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../db/rca.js', () => ({
  createRun: (...args: unknown[]) => createRunMock(...args),
  getRun: (...args: unknown[]) => getRunMock(...args),
  updateRun: (...args: unknown[]) => updateRunMock(...args),
}));

vi.mock('../jobs/rcaWorker.js', () => ({
  initRcaWorker: vi.fn(),
  enqueueRcaJob: (...args: unknown[]) => enqueueMock(...args),
}));

vi.mock('../services/rcaInput.js', () => ({
  prepareRcaInput: vi.fn().mockResolvedValue({
    crashGroup: { id: 'regression-001' },
    app: { id: 'ios_main' },
  }),
}));

import { createRcaRouter } from './rca.js';
import type { ServerConfig } from '../config.js';
import { MockCrashlyticsProvider } from '../crashlytics/mock.js';

const report = {
  crashGroupId: 'regression-001',
  summary: 'Test summary',
  likelyCause: 'Test cause',
  suspectPrs: [],
  confidence: 0.8,
  evidence: [],
  skillVersion: 'rca-skill-v2',
  model: 'openai:gpt-4o',
  costUsd: 0.01,
  createdAt: '2026-06-05T12:00:00.000Z',
};

const runLog = {
  runId: 'rca-1',
  explorerModel: 'google:gemini-2.0-flash',
  synthesisModel: 'openai:gpt-4o',
  inputTokens: 100,
  outputTokens: 50,
  costUsd: 0.01,
  budgetOk: true,
  durationMs: 1000,
  explorerMode: 'mock' as const,
  integrationLevel: 'minimal' as const,
  skillVersion: 'rca-skill-v2',
  phases: [],
};

function baseConfig(databaseUrl: string): ServerConfig {
  return {
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
    databaseUrl,
    llm: {
      explorerModel: 'google:gemini-2.0-flash',
      synthesisModel: 'openai:gpt-4o',
    },
    rcaMaxBudgetUsd: 0.5,
  };
}

function createApp(config: ServerConfig) {
  const app = express();
  app.use(express.json());
  app.use('/api/rca', createRcaRouter(config, new MockCrashlyticsProvider()));
  return app;
}

describe('POST /api/rca', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    runRcaMock.mockResolvedValue({ report, edges: [], runLog });
    createRunMock.mockResolvedValue({ id: 'rca-1', status: 'queued' });
    updateRunMock.mockResolvedValue({});
  });

  it('returns 400 when body is incomplete', async () => {
    const res = await request(createApp(baseConfig(''))).post('/api/rca').send({});
    expect(res.status).toBe(400);
  });

  it('returns RCA report for valid crash group in sync mode', async () => {
    const res = await request(createApp(baseConfig('')))
      .post('/api/rca?sync=true')
      .send({ crashGroupId: 'regression-001', appId: 'ios_main' });

    expect(res.status).toBe(200);
    expect(res.body.summary).toBe('Test summary');
    expect(res.body.skillVersion).toBe('rca-skill-v2');
  });

  it('returns 202 with runId in async mode', async () => {
    const res = await request(createApp(baseConfig('postgres://local/test')))
      .post('/api/rca')
      .send({ crashGroupId: 'regression-001', appId: 'ios_main' });

    expect(res.status).toBe(202);
    expect(res.body.runId).toBeDefined();
    expect(enqueueMock).toHaveBeenCalled();
  });
});

describe('GET /api/rca/:runId', () => {
  it('returns run status', async () => {
    getRunMock.mockResolvedValue({
      id: 'rca-1',
      status: 'completed',
      report,
      runLog,
      error: null,
      createdAt: '2026-06-05T12:00:00.000Z',
      completedAt: '2026-06-05T12:00:05.000Z',
    });

    const res = await request(createApp(baseConfig('postgres://local/test'))).get('/api/rca/rca-1');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('completed');
    expect(res.body.report.summary).toBe('Test summary');
  });
});
