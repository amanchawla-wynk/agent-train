import cors from 'cors';
import express from 'express';
import { loadConfig } from './config.js';
import { createCrashlyticsProvider } from './crashlytics/provider.js';
import { checkDbConnection } from './db/pool.js';
import { scheduleDailyDigest } from './jobs/dailyDigest.js';
import { createAppsRouter } from './routes/apps.js';
import { createCrashGroupsRouter } from './routes/crashGroups.js';
import { createRcaRouter } from './routes/rca.js';

const config = loadConfig();
const provider = createCrashlyticsProvider(config);

const app = express();

app.use(
  cors({
    origin: ['http://localhost:5173', 'http://127.0.0.1:5173'],
  }),
);
app.use(express.json());

app.get('/api/health', async (_req, res) => {
  const dbOk = config.databaseUrl ? await checkDbConnection() : false;
  res.json({
    status: 'ok',
    dataSource: config.dataSource,
    apps: config.apps.map((a) => a.id),
    integrations: {
      serena: config.serenaMcpCommand ? 'configured' : 'mock',
      firebase:
        process.env.FIREBASE_MCP_ENABLED === 'true' || process.env.FIREBASE_MCP_COMMAND
          ? 'configured'
          : 'mock',
      github: config.githubToken ? 'configured' : 'missing',
      postgres: dbOk ? 'connected' : config.databaseUrl ? 'disconnected' : 'not_configured',
    },
  });
});

app.use('/api/apps', createAppsRouter(config));
app.use('/api/crash-groups', createCrashGroupsRouter(config, provider));
app.use('/api/rca', createRcaRouter(config, provider));

scheduleDailyDigest(config, provider);

app.listen(config.port, () => {
  console.log(`Server listening on http://localhost:${config.port}`);
  console.log(`Data source: ${config.dataSource}`);
});
