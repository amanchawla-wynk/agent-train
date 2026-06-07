import { Router } from 'express';
import {
  buildPrdAgentRuntimeConfig,
  BudgetExceededError,
  runPrdGapReview,
} from '@agent-train/agents';
import type { ServerConfig } from '../config.js';
import { insertEdges } from '../db/edges.js';
import {
  createPrdReviewRun,
  getPrdReviewRun,
  updatePrdReviewRun,
} from '../db/prdReview.js';
import { enqueuePrdReviewJob, initPrdReviewWorker } from '../jobs/prdReviewWorker.js';
import { loadPrdFixture } from '../services/prdFixtures.js';

export function createPrdReviewRouter(config: ServerConfig): Router {
  initPrdReviewWorker(config);
  const router = Router();

  router.get('/:runId', async (req, res) => {
    if (!config.databaseUrl) {
      res.status(503).json({ error: 'PRD review storage requires DATABASE_URL' });
      return;
    }

    const run = await getPrdReviewRun(req.params.runId);
    if (!run) {
      res.status(404).json({ error: 'Run not found' });
      return;
    }

    res.json({
      runId: run.id,
      status: run.status,
      report: run.report,
      runLog: run.runLog,
      error: run.error,
      createdAt: run.createdAt,
      completedAt: run.completedAt,
    });
  });

  router.post('/', async (req, res) => {
    const prdId = String(req.body?.prdId ?? '');
    const sync = req.query.sync === 'true';

    if (!prdId) {
      res.status(400).json({ error: 'prdId is required' });
      return;
    }

    if (!config.prdIds.includes(prdId)) {
      res.status(404).json({ error: `Unknown PRD: ${prdId}` });
      return;
    }

    try {
      const document = await loadPrdFixture(prdId);
      if (!document) {
        res.status(404).json({ error: `PRD fixture not found: ${prdId}` });
        return;
      }

      if (sync) {
        const agentConfig = buildPrdAgentRuntimeConfig({
          llm: config.llm,
          maxBudgetUsd: config.rcaMaxBudgetUsd,
          prdMaxBudgetUsd: config.prdMaxBudgetUsd,
        });

        const result = await runPrdGapReview(
          { prdId, document },
          agentConfig,
        );

        if (config.databaseUrl) {
          await insertEdges(result.edges);
          await createPrdReviewRun(result.runLog.runId, prdId);
          await updatePrdReviewRun(result.runLog.runId, {
            status: 'completed',
            report: result.report,
            runLog: result.runLog,
            completedAt: new Date().toISOString(),
          });
        }

        console.log('[prd-review] run complete', result.runLog);
        res.json(result.report);
        return;
      }

      if (!config.databaseUrl) {
        res.status(503).json({
          error: 'Async PRD review requires DATABASE_URL. Use ?sync=true for synchronous mode.',
        });
        return;
      }

      const runId = `prd-${Date.now()}`;
      await createPrdReviewRun(runId, prdId);
      enqueuePrdReviewJob({ runId, prdId });

      res.status(202).json({ runId, status: 'queued' });
    } catch (err) {
      if (err instanceof BudgetExceededError) {
        res.status(402).json({ error: err.message });
        return;
      }
      console.error('[prd-review] failed:', err);
      res.status(500).json({
        error: err instanceof Error ? err.message : 'PRD review failed',
      });
    }
  });

  return router;
}
