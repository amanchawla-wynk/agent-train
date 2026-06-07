import { describe, expect, it } from 'vitest';
import { derivePrdGapEdges, PrdGapReportBodySchema } from './prd.js';

describe('PrdGapReportBodySchema', () => {
  it('accepts valid gap report', () => {
    const result = PrdGapReportBodySchema.safeParse({
      prdId: 'playback-redesign',
      prdTitle: 'Playback Redesign',
      summary: 'Missing rollout plan',
      gaps: [
        {
          id: 'missing-rollout',
          category: 'rollout',
          severity: 'critical',
          summary: 'No rollout strategy',
          detail: 'PRD lacks phased rollout or kill switch',
          sectionRef: '## Rollout',
          confidence: 0.9,
          evidence: [
            {
              source: 'confluence',
              ref: 'playback-redesign#rollout',
              detail: 'Rollout section absent',
            },
          ],
        },
      ],
      completenessScore: 0.55,
      confidence: 0.85,
    });
    expect(result.success).toBe(true);
  });
});

describe('derivePrdGapEdges', () => {
  it('maps gaps to prd has_gap edges', () => {
    const edges = derivePrdGapEdges(
      {
        prdId: 'playback-redesign',
        gaps: [
          {
            id: 'missing-rollout',
            category: 'rollout',
            severity: 'critical',
            summary: 'No rollout',
            detail: 'detail',
            sectionRef: 'Rollout',
            confidence: 0.9,
            evidence: [],
          },
        ],
      },
      'prd-gap-skill-v1',
      '2026-06-08T12:00:00.000Z',
      'prd-run-1',
    );

    expect(edges).toHaveLength(1);
    expect(edges[0]).toEqual({
      from: 'prd:playback-redesign',
      to: 'gap:playback-redesign:missing-rollout',
      relation: 'has_gap',
      confidence: 0.9,
      source: 'prd-gap-skill-v1:prd-run-1',
      observedAt: '2026-06-08T12:00:00.000Z',
    });
  });
});
