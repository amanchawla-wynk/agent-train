import { Router } from 'express';
import type { ServerConfig } from '../config.js';
import type { CrashlyticsProvider } from '../crashlytics/types.js';
import { AppNotFoundError, fetchRankedCrashGroups } from '../services/crashGroups.js';

export function createCrashGroupsRouter(
  config: ServerConfig,
  provider: CrashlyticsProvider,
): Router {
  const router = Router();

  router.get('/', async (req, res) => {
    const app = String(req.query.app ?? '');
    const days = Number(req.query.days ?? 7);

    if (!app) {
      res.status(400).json({ error: 'Query parameter "app" is required' });
      return;
    }

    if (!Number.isFinite(days) || days < 1 || days > 90) {
      res.status(400).json({ error: 'Query parameter "days" must be between 1 and 90' });
      return;
    }

    try {
      const groups = await fetchRankedCrashGroups(provider, config, app, days);
      res.json(groups);
    } catch (err) {
      if (err instanceof AppNotFoundError) {
        res.status(404).json({ error: err.message });
        return;
      }
      console.error('Failed to fetch crash groups:', err);
      res.status(500).json({ error: 'Failed to fetch crash groups' });
    }
  });

  return router;
}
