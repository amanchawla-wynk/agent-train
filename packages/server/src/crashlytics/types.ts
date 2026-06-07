import type { AppConfig } from '../config.js';

export interface RawCrashRow {
  issueId: string;
  issueTitle: string;
  issueSubtitle: string;
  eventCount: number;
  usersAffected: number;
  eventsLast24h: number;
  eventsPrev24h: number;
  firstSeenVersion: string;
  latestVersion: string;
}

export interface CrashlyticsProvider {
  fetchCrashGroups(app: AppConfig, sinceDays: number): Promise<RawCrashRow[]>;
}
