import { describe, expect, it, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

const runPrdGapReviewMock = vi.fn();

vi.mock('@agent-train/agents', () => ({
  runPrdGapReview: (...args: unknown[]) => runPrdGapReviewMock(...args),
  buildPrdAgentRuntimeConfig: vi.fn().mockReturnValue({}),
  BudgetExceededError: class BudgetExceededError extends Error {},
}));

vi.mock('../db/edges.js', () => ({
  insertEdges: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../db/prdReview.js', () => ({
  createPrdReviewRun: vi.fn().mockResolvedValue({ id: 'prd-1', status: 'queued' }),
  getPrdReviewRun: vi.fn(),
  updatePrdReviewRun: vi.fn().mockResolvedValue({}),
}));

vi.mock('../jobs/prdReviewWorker.js', () => ({
  initPrdReviewWorker: vi.fn(),
  enqueuePrdReviewJob: vi.fn(),
}));

import { createPrdReviewRouter } from './prdReview.js';
import type { ServerConfig } from '../config.js';

const report = {
  prdId: 'playback-redesign',
  prdTitle: 'Playback Redesign PRD',
  summary: 'Missing rollout and edge cases',
  gaps: [
    {
      id: 'missing-rollout',
      category: 'rollout',
      severity: 'critical',
      summary: 'No rollout plan',
      detail: 'detail',
      sectionRef: 'Rollout',
      confidence: 0.9,
      evidence: [{ source: 'confluence', ref: 'playback-redesign', detail: 'absent' }],
    },
  ],
  completenessScore: 0.5,
  confidence: 0.85,
  skillVersion: 'prd-gap-skill-v1',
  model: 'openai:gpt-4o',
  costUsd: 0.01,
  createdAt: '2026-06-08T12:00:00.000Z',
};

function baseConfig(databaseUrl: string): ServerConfig {
  return {
    port: 3001,
    dataSource: 'mock',
    bigQueryProjectId: '',
    crashlyticsDataset: 'firebase_crashlytics',
    apps: [],
    prdIds: ['playback-redesign', 'onboarding-v2'],
    digestWebhookUrl: '',
    digestTopN: 10,
    digestCron: '0 9 * * *',
    databaseUrl,
    llm: {
      explorerModel: 'google:gemini-2.0-flash',
      synthesisModel: 'openai:gpt-4o',
    },
    rcaMaxBudgetUsd: 0.5,
    prdMaxBudgetUsd: 0.3,
  };
}

function createApp(config: ServerConfig) {
  const app = express();
  app.use(express.json());
  app.use('/api/prd-review', createPrdReviewRouter(config));
  return app;
}

describe('POST /api/prd-review', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    runPrdGapReviewMock.mockResolvedValue({
      report,
      edges: [],
      runLog: {
        runId: 'prd-1',
        reviewModel: 'openai:gpt-4o',
        inputTokens: 100,
        outputTokens: 50,
        costUsd: 0.01,
        budgetOk: true,
        durationMs: 500,
        atlassianMode: 'mock',
        skillVersion: 'prd-gap-skill-v1',
        phases: [],
      },
    });
  });

  it('returns 400 when prdId missing', async () => {
    const res = await request(createApp(baseConfig(''))).post('/api/prd-review').send({});
    expect(res.status).toBe(400);
  });

  it('returns gap report in sync mode', async () => {
    const res = await request(createApp(baseConfig('')))
      .post('/api/prd-review?sync=true')
      .send({ prdId: 'playback-redesign' });

    expect(res.status).toBe(200);
    expect(res.body.prdId).toBe('playback-redesign');
    expect(res.body.gaps.length).toBeGreaterThan(0);
  });
});
