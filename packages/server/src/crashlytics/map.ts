import {
  compareAppVersion,
  maxAppVersion,
  type CrashGroupInput,
} from '@agent-train/shared';
import type { RawCrashRow } from './types.js';

function clampVelocityPct(eventsLast24h: number, eventsPrev24h: number): number {
  const delta = eventsLast24h - eventsPrev24h;
  const base = Math.max(eventsPrev24h, 1);
  const pct = (delta / base) * 100;
  return Math.max(-100, Math.min(500, pct));
}

export function deriveCurrentVersion(rows: RawCrashRow[]): string {
  return maxAppVersion(rows.map((r) => r.latestVersion));
}

export function mapRawRowToCrashGroup(
  row: RawCrashRow,
  app: string,
  currentVersion: string,
): CrashGroupInput {
  const isRegression =
    currentVersion.length > 0 &&
    row.firstSeenVersion.length > 0 &&
    compareAppVersion(row.firstSeenVersion, currentVersion) >= 0;

  return {
    id: row.issueId,
    app,
    title: row.issueTitle,
    signature: row.issueSubtitle,
    usersAffected: row.usersAffected,
    eventCount: row.eventCount,
    velocityPct: clampVelocityPct(row.eventsLast24h, row.eventsPrev24h),
    firstSeenVersion: row.firstSeenVersion,
    latestVersion: row.latestVersion,
    isRegression,
  };
}

export function mapRawRowsToCrashGroups(
  rows: RawCrashRow[],
  app: string,
): CrashGroupInput[] {
  const currentVersion = deriveCurrentVersion(rows);
  return rows.map((row) => mapRawRowToCrashGroup(row, app, currentVersion));
}
