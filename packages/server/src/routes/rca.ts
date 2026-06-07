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
import { AppNotFoundError, fetchRankedCrashGroups } from '../services/crashGroups.js';

export function createRcaRouter(
  config: ServerConfig,
  provider: CrashlyticsProvider,
): Router {
  const router = Router();

  router.post('/', async (req, res) => {
    const crashGroupId = String(req.body?.crashGroupId ?? '');
    const appId = String(req.body?.appId ?? '');
    const days = Number(req.body?.days ?? 7);

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

      const agentConfig = buildAgentRuntimeConfig({
        llm: config.llm,
        maxBudgetUsd: config.rcaMaxBudgetUsd,
        githubToken: config.githubToken,
        serenaMcpCommand: config.serenaMcpCommand,
        serenaMcpArgs: config.serenaMcpArgs,
        serenaRepoPath: config.serenaRepoPath,
      });

      const result = await runRca(
        {
          crashGroup,
          app: appAgentConfigFromApp(app),
        },
        agentConfig,
      );

      if (config.databaseUrl) {
        await insertEdges(result.edges);
      }

      console.log('[rca] run complete', result.runLog);

      res.json(result.report);
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
