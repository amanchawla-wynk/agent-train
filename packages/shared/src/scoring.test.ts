import { describe, expect, it } from 'vitest';
import { scoreCrashGroup } from './scoring.js';
import type { CrashGroupInput, ScoringContext } from './types.js';

const baseCtx: ScoringContext = {
  currentVersion: '2.5.0',
  usersWeight: 1,
  velocityWeight: 1,
  regressionWeight: 4,
  recencyWeight: 1,
};

function makeCrash(overrides: Partial<CrashGroupInput>): CrashGroupInput {
  return {
    id: 'issue-1',
    app: 'ios_main',
    title: 'EXC_BAD_ACCESS',
    signature: 'PlaybackController.swift',
    usersAffected: 100,
    eventCount: 500,
    velocityPct: 10,
    firstSeenVersion: '2.4.0',
    latestVersion: '2.4.0',
    isRegression: false,
    ...overrides,
  };
}

describe('scoreCrashGroup', () => {
  it('ranks regression higher than higher-volume stable group', () => {
    const stable = makeCrash({
      id: 'stable',
      usersAffected: 10_000,
      eventCount: 50_000,
      velocityPct: 5,
      isRegression: false,
      firstSeenVersion: '1.0.0',
      latestVersion: '2.4.0',
    });

    const regression = makeCrash({
      id: 'regression',
      usersAffected: 50,
      eventCount: 100,
      velocityPct: 200,
      isRegression: true,
      firstSeenVersion: '2.5.0',
      latestVersion: '2.5.0',
    });

    const stableScore = scoreCrashGroup(stable, baseCtx);
    const regressionScore = scoreCrashGroup(regression, baseCtx);

    expect(regressionScore).toBeGreaterThan(stableScore);
  });

  it('returns stable ordering for identical inputs', () => {
    const crash = makeCrash({ id: 'a' });
    const score1 = scoreCrashGroup(crash, baseCtx);
    const score2 = scoreCrashGroup(crash, baseCtx);
    expect(score1).toBe(score2);
  });

  it('handles zero users', () => {
    const crash = makeCrash({ usersAffected: 0, eventCount: 0 });
    const score = scoreCrashGroup(crash, baseCtx);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });

  it('handles missing version strings', () => {
    const crash = makeCrash({
      firstSeenVersion: '',
      latestVersion: '',
      isRegression: false,
    });
    const score = scoreCrashGroup(crash, baseCtx);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });

  it('scores within 0-100 range', () => {
    const crash = makeCrash({
      usersAffected: 1_000_000,
      velocityPct: 1000,
      isRegression: true,
      latestVersion: '2.5.0',
    });
    const score = scoreCrashGroup(crash, baseCtx);
    expect(score).toBeLessThanOrEqual(100);
    expect(score).toBeGreaterThanOrEqual(0);
  });
});
