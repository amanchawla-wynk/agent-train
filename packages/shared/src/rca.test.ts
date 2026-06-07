import { describe, expect, it } from 'vitest';
import {
  deriveEdgesFromReport,
  ExplorerContextPackageSchema,
  RcaReportBodySchema,
} from './rca.js';

describe('RcaReportBodySchema', () => {
  it('accepts valid report body', () => {
    const result = RcaReportBodySchema.safeParse({
      crashGroupId: 'regression-001',
      summary: 'Null pointer in playback',
      likelyCause: 'Missing guard in PlaybackController',
      suspectPrs: [
        {
          repo: 'myorg/ios-app',
          number: 432,
          reason: 'Touched PlaybackController.swift',
          confidence: 0.88,
        },
      ],
      confidence: 0.85,
      evidence: [
        {
          source: 'github',
          ref: 'PR-432',
          detail: 'Changed PlaybackController.swift',
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid confidence', () => {
    const result = RcaReportBodySchema.safeParse({
      crashGroupId: 'x',
      summary: 's',
      likelyCause: 'c',
      suspectPrs: [],
      confidence: 1.5,
      evidence: [],
    });
    expect(result.success).toBe(false);
  });
});

describe('deriveEdgesFromReport', () => {
  it('maps suspect PRs to crash edges', () => {
    const edges = deriveEdgesFromReport(
      {
        crashGroupId: 'regression-001',
        suspectPrs: [
          {
            repo: 'myorg/ios-app',
            number: 432,
            reason: 'Recent change',
            confidence: 0.9,
          },
        ],
      },
      'rca-skill-v2',
      '2026-06-05T12:00:00.000Z',
      'rca-run-1',
    );

    expect(edges).toHaveLength(1);
    expect(edges[0]).toEqual({
      from: 'crash:regression-001',
      to: 'pr:myorg/ios-app#432',
      relation: 'introduced_by',
      confidence: 0.9,
      source: 'rca-skill-v2:rca-run-1',
      observedAt: '2026-06-05T12:00:00.000Z',
    });
  });
});

describe('ExplorerContextPackageSchema', () => {
  it('accepts valid explorer output', () => {
    const result = ExplorerContextPackageSchema.safeParse({
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
      stackSummary: 'EXC_BAD_ACCESS at PlaybackController.swift:142',
      dependencies: ['PlaybackController callers'],
      relatedHistory: [],
      summary: 'Crash in playback controller',
      unknowns: [],
    });
    expect(result.success).toBe(true);
  });
});
