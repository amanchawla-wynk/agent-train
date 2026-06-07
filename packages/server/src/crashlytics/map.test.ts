import { describe, expect, it } from 'vitest';
import { deriveCurrentVersion, mapRawRowToCrashGroup, mapRawRowsToCrashGroups } from './map.js';
import type { RawCrashRow } from './types.js';

const regressionRow: RawCrashRow = {
  issueId: 'reg-1',
  issueTitle: 'EXC_BAD_ACCESS',
  issueSubtitle: 'Foo.swift:1',
  eventCount: 100,
  usersAffected: 50,
  eventsLast24h: 40,
  eventsPrev24h: 10,
  firstSeenVersion: '2.5.0',
  latestVersion: '2.5.0',
};

const stableRow: RawCrashRow = {
  issueId: 'stable-1',
  issueTitle: 'NSException',
  issueSubtitle: 'Bar.swift:2',
  eventCount: 5000,
  usersAffected: 2000,
  eventsLast24h: 100,
  eventsPrev24h: 95,
  firstSeenVersion: '1.0.0',
  latestVersion: '2.4.0',
};

describe('mapRawRowsToCrashGroups', () => {
  it('derives current version from max latestVersion', () => {
    expect(deriveCurrentVersion([stableRow, regressionRow])).toBe('2.5.0');
  });

  it('flags regression when firstSeenVersion is at or after current version', () => {
    const groups = mapRawRowsToCrashGroups([regressionRow, stableRow], 'ios_main');
    const regression = groups.find((g) => g.id === 'reg-1');
    const stable = groups.find((g) => g.id === 'stable-1');
    expect(regression?.isRegression).toBe(true);
    expect(stable?.isRegression).toBe(false);
  });

  it('computes velocity percentage', () => {
    const group = mapRawRowToCrashGroup(regressionRow, 'ios_main', '2.5.0');
    expect(group.velocityPct).toBe(300);
  });
});
