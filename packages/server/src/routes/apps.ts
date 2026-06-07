import { Router } from 'express';
import type { ServerConfig } from '../config.js';

export function createAppsRouter(config: ServerConfig): Router {
  const router = Router();

  router.get('/', (_req, res) => {
    res.json(config.apps.map((a) => ({ id: a.id })));
  });

  return router;
}
