import { describe, expect, it } from 'vitest';
import { formatDigestCard, scoreTier } from './formatter.js';
import type { CrashGroup } from '@agent-train/shared';

const sampleGroup: CrashGroup = {
  id: 'issue-1',
  app: 'ios_main',
  title: 'EXC_BAD_ACCESS',
  signature: 'Foo.swift:1',
  usersAffected: 100,
  eventCount: 200,
  velocityPct: 50,
  firstSeenVersion: '2.5.0',
  latestVersion: '2.5.0',
  isRegression: true,
  priorityScore: 85,
};

describe('formatDigestCard', () => {
  it('formats Teams MessageCard with regression theme', () => {
    const card = formatDigestCard('ios_main', [sampleGroup], 10);
    expect(card['@type']).toBe('MessageCard');
    expect(card.title).toContain('ios_main');
    expect(card.themeColor).toBe('D13438');
    expect(card.sections[0]?.activityTitle).toContain('REGRESSION');
  });

  it('limits to top N groups', () => {
    const groups = Array.from({ length: 15 }, (_, i) => ({
      ...sampleGroup,
      id: `issue-${i}`,
      priorityScore: 90 - i,
    }));
    const card = formatDigestCard('ios_main', groups, 5);
    expect(card.sections).toHaveLength(5);
  });
});

describe('scoreTier', () => {
  it('assigns tiers by threshold', () => {
    expect(scoreTier(85)).toBe('danger');
    expect(scoreTier(60)).toBe('warning');
    expect(scoreTier(30)).toBe('muted');
  });
});
