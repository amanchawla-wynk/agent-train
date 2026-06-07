import { Router } from 'express';
import {
  appAgentConfigFromApp,
  buildAgentRuntimeConfig,
  BudgetExceededError,
  runRca,
} from '@agent-train/agents';
import type { ServerConfig } from '../config.js';
import { getAppConfig } from '../config.js';
import type { CrashlyticsProvider } from '../crashlytics/types.js';
import { insertEdges } from '../db/edges.js';
import { createRun, getRun, updateRun } from '../db/rca.js';
import { enqueueRcaJob, initRcaWorker } from '../jobs/rcaWorker.js';
import { AppNotFoundError, fetchRankedCrashGroups } from '../services/crashGroups.js';
import { prepareRcaInput } from '../services/rcaInput.js';

export function createRcaRouter(
  config: ServerConfig,
  provider: CrashlyticsProvider,
): Router {
  initRcaWorker(config, provider);
  const router = Router();

  router.get('/:runId', async (req, res) => {
    if (!config.databaseUrl) {
      res.status(503).json({ error: 'RCA run storage requires DATABASE_URL' });
      return;
    }

    const run = await getRun(req.params.runId);
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
    const crashGroupId = String(req.body?.crashGroupId ?? '');
    const appId = String(req.body?.appId ?? '');
    const days = Number(req.body?.days ?? 7);
    const sync = req.query.sync === 'true';

    if (!crashGroupId || !appId) {
      res.status(400).json({ error: 'crashGroupId and appId are required' });
      return;
    }

    const app = getAppConfig(config, appId);
    if (!app) {
      res.status(404).json({ error: `Unknown app: ${appId}` });
      return;
    }

    try {
      const groups = await fetchRankedCrashGroups(provider, config, appId, days);
      const crashGroup = groups.find((g) => g.id === crashGroupId);
      if (!crashGroup) {
        res.status(404).json({ error: `Crash group not found: ${crashGroupId}` });
        return;
      }

      if (sync) {
        const agentConfig = buildAgentRuntimeConfig({
          llm: config.llm,
          maxBudgetUsd: config.rcaMaxBudgetUsd,
          githubToken: config.githubToken,
          serenaMcpCommand: config.serenaMcpCommand,
          serenaMcpArgs: config.serenaMcpArgs,
          serenaRepoPath: config.serenaRepoPath,
        });

        const input = await prepareRcaInput(crashGroup, app, config);
        const result = await runRca(input, agentConfig);

        if (config.databaseUrl) {
          await insertEdges(result.edges);
          await createRun(result.runLog.runId, crashGroupId, appId);
          await updateRun(result.runLog.runId, {
            status: 'completed',
            report: result.report,
            runLog: result.runLog,
            completedAt: new Date().toISOString(),
          });
        }

        console.log('[rca] run complete', result.runLog);
        res.json(result.report);
        return;
      }

      if (!config.databaseUrl) {
        res.status(503).json({
          error: 'Async RCA requires DATABASE_URL. Use ?sync=true for synchronous mode.',
        });
        return;
      }

      const runId = `rca-${Date.now()}`;
      await createRun(runId, crashGroupId, appId);
      enqueueRcaJob({ runId, crashGroupId, appId, days });

      res.status(202).json({ runId, status: 'queued' });
    } catch (err) {
      if (err instanceof AppNotFoundError) {
        res.status(404).json({ error: err.message });
        return;
      }
      if (err instanceof BudgetExceededError) {
        res.status(402).json({ error: err.message });
        return;
      }
      console.error('[rca] failed:', err);
      res.status(500).json({
        error: err instanceof Error ? err.message : 'RCA failed',
      });
    }
  });

  return router;
}
