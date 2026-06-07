import { describe, expect, it } from 'vitest';
import { computeFilesOverlap, computeTimingScore } from './timing.js';

describe('computeTimingScore', () => {
  it('returns higher score for recent merges', () => {
    const recent = computeTimingScore('2.5.0', new Date().toISOString());
    const old = computeTimingScore(
      '2.5.0',
      new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
    );
    expect(recent).toBeGreaterThan(old);
  });
});

describe('computeFilesOverlap', () => {
  it('finds overlapping paths', () => {
    const overlap = computeFilesOverlap(
      ['Sources/PlaybackController.swift', 'Other.swift'],
      ['PlaybackController.swift'],
    );
    expect(overlap).toContain('Sources/PlaybackController.swift');
  });
});
