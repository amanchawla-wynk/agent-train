import { loadConfig } from '../config.js';
import { createCrashlyticsProvider } from '../crashlytics/provider.js';
import { runDailyDigest } from '../jobs/dailyDigest.js';

const config = loadConfig();
const provider = createCrashlyticsProvider(config);

runDailyDigest(config, provider)
  .then(() => {
    console.log('[digest] Manual digest run complete');
    process.exit(0);
  })
  .catch((err) => {
    console.error('[digest] Manual digest run failed:', err);
    process.exit(1);
  });
