import { Router } from 'express';
import type { ServerConfig } from '../config.js';
import { listPrdFixtures } from '../services/prdFixtures.js';

export function createPrdsRouter(config: ServerConfig): Router {
  const router = Router();

  router.get('/', async (_req, res) => {
    const items = await listPrdFixtures(config.prdIds);
    const atlassianLive =
      process.env.ATLASSIAN_MCP_ENABLED === 'true' ||
      Boolean(process.env.ATLASSIAN_MCP_COMMAND?.trim());

    res.json(
      items.map((item) => ({
        ...item,
        source: atlassianLive ? 'live' : item.source,
      })),
    );
  });

  return router;
}
