import { describe, expect, it } from 'vitest';
import { buildMockExplorerPackage } from './explorer-mock.js';
import type { CrashGroup } from '@agent-train/shared';

const crash: CrashGroup = {
  id: 'regression-001',
  app: 'ios_main',
  title: 'EXC_BAD_ACCESS in PlaybackController',
  signature: 'PlaybackController.swift:142',
  usersAffected: 180,
  eventCount: 320,
  velocityPct: 275,
  firstSeenVersion: '2.5.0',
  latestVersion: '2.5.0',
  isRegression: true,
  priorityScore: 60,
};

describe('buildMockExplorerPackage', () => {
  it('derives file and PR from signature', () => {
    const pkg = buildMockExplorerPackage(crash, 'myorg/ios-app');
    expect(pkg.crashGroupId).toBe('regression-001');
    expect(pkg.filesTouched).toContain('PlaybackController.swift');
    expect(pkg.recentPrs[0]?.number).toBe(432);
    expect(pkg.unknowns[0]).toContain('mock');
  });
});
