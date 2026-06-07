import cron from 'node-cron';
import type { ServerConfig } from '../config.js';
import type { CrashlyticsProvider } from '../crashlytics/types.js';
import { postDigestToTeams } from '../digest/poster.js';
import { fetchRankedCrashGroups } from '../services/crashGroups.js';

export async function runDailyDigest(
  config: ServerConfig,
  provider: CrashlyticsProvider,
  sinceDays = 7,
): Promise<void> {
  for (const app of config.apps) {
    const groups = await fetchRankedCrashGroups(provider, config, app.id, sinceDays);
    await postDigestToTeams(config.digestWebhookUrl, app.id, groups, config.digestTopN);
    console.log(`[digest] Posted digest for ${app.id} (${groups.length} groups)`);
  }
}

export function scheduleDailyDigest(
  config: ServerConfig,
  provider: CrashlyticsProvider,
): void {
  if (!cron.validate(config.digestCron)) {
    console.warn(`[digest] Invalid DIGEST_CRON "${config.digestCron}" — scheduler disabled`);
    return;
  }

  cron.schedule(config.digestCron, () => {
    runDailyDigest(config, provider).catch((err) => {
      console.error('[digest] Scheduled digest failed:', err);
    });
  });

  console.log(`[digest] Scheduled daily digest: ${config.digestCron}`);
}
