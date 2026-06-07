import { describe, expect, it } from 'vitest';
import type { ExplorerContextPackage, RcaReportBody } from '@agent-train/shared';
import { verifyAndCleanReport } from './verify.js';

const contextPackage: ExplorerContextPackage = {
  crashGroupId: 'regression-001',
  filesTouched: ['PlaybackController.swift'],
  symbols: [{ name: 'play()', file: 'PlaybackController.swift', role: 'crashing' }],
  recentPrs: [
    {
      repo: 'myorg/ios-app',
      number: 432,
      title: 'Fix playback',
      mergedAt: '2026-06-01',
    },
  ],
  dependencies: [],
  relatedHistory: [],
  summary: 'Crash in playback',
  stackSummary: 'EXC_BAD_ACCESS PlaybackController.swift:142',
  unknowns: [],
};

describe('verifyAndCleanReport', () => {
  it('removes hallucinated PR numbers', () => {
    const report: RcaReportBody = {
      crashGroupId: 'regression-001',
      summary: 'Test',
      likelyCause: 'Cause',
      suspectPrs: [
        {
          repo: 'myorg/ios-app',
          number: 999,
          reason: 'Hallucinated',
          confidence: 0.9,
        },
        {
          repo: 'myorg/ios-app',
          number: 432,
          reason: 'Real',
          confidence: 0.85,
        },
      ],
      confidence: 0.9,
      evidence: [
        { source: 'github', ref: 'PR-999', detail: 'bad' },
        { source: 'github', ref: 'PR-432', detail: 'good' },
      ],
    };

    const cleaned = verifyAndCleanReport(report, contextPackage);
    expect(cleaned.suspectPrs).toHaveLength(1);
    expect(cleaned.suspectPrs[0].number).toBe(432);
    expect(cleaned.evidence).toHaveLength(1);
  });
});
