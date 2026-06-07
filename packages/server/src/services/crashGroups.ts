import type { CrashGroup } from '@agent-train/shared';
import type { ServerConfig } from '../config.js';
import { getAppConfig } from '../config.js';
import type { CrashlyticsProvider } from '../crashlytics/types.js';
import { rankRawCrashRows } from '../ranking.js';

export async function fetchRankedCrashGroups(
  provider: CrashlyticsProvider,
  config: ServerConfig,
  appId: string,
  sinceDays: number,
): Promise<CrashGroup[]> {
  const app = getAppConfig(config, appId);
  if (!app) {
    throw new AppNotFoundError(appId);
  }

  const rows = await provider.fetchCrashGroups(app, sinceDays);
  return rankRawCrashRows(rows, app.id);
}

export class AppNotFoundError extends Error {
  constructor(appId: string) {
    super(`Unknown app: ${appId}`);
    this.name = 'AppNotFoundError';
  }
}
