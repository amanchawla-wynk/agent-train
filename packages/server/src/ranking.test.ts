import { describe, expect, it } from 'vitest';
import { rankRawCrashRows } from './ranking.js';
import type { RawCrashRow } from './crashlytics/types.js';

const rows: RawCrashRow[] = [
  {
    issueId: 'regression-001',
    issueTitle: 'EXC_BAD_ACCESS',
    issueSubtitle: 'A.swift',
    eventCount: 320,
    usersAffected: 180,
    eventsLast24h: 150,
    eventsPrev24h: 40,
    firstSeenVersion: '2.5.0',
    latestVersion: '2.5.0',
  },
  {
    issueId: 'stable-001',
    issueTitle: 'NSException',
    issueSubtitle: 'B.swift',
    eventCount: 12000,
    usersAffected: 4500,
    eventsLast24h: 400,
    eventsPrev24h: 390,
    firstSeenVersion: '1.2.0',
    latestVersion: '2.4.0',
  },
];

describe('rankRawCrashRows', () => {
  it('ranks regression above high-volume stable crash', () => {
    const ranked = rankRawCrashRows(rows, 'ios_main');
    expect(ranked[0]?.id).toBe('regression-001');
    expect(ranked[0]?.priorityScore).toBeGreaterThan(ranked[1]?.priorityScore ?? 0);
  });

  it('sorts by priorityScore descending', () => {
    const ranked = rankRawCrashRows(rows, 'ios_main');
    for (let i = 1; i < ranked.length; i++) {
      expect(ranked[i - 1]!.priorityScore).toBeGreaterThanOrEqual(ranked[i]!.priorityScore);
    }
  });
});
