import { describe, expect, it, vi, beforeEach } from 'vitest';

const queryMock = vi.fn();

vi.mock('./pool.js', () => ({
  getPool: () => ({ query: queryMock }),
}));

import { buildRelatedHistoryForCrash, getRelatedPrsForCrash } from './graph.js';

describe('graph read API', () => {
  beforeEach(() => {
    queryMock.mockReset();
  });

  it('getRelatedPrsForCrash queries crash entity', async () => {
    queryMock.mockResolvedValue({
      rows: [
        {
          from: 'crash:regression-001',
          to: 'pr:myorg/ios-app#432',
          relation: 'introduced_by',
          confidence: 0.9,
          source: 'rca-skill-v1',
          observed_at: new Date('2026-06-05'),
        },
      ],
    });

    const edges = await getRelatedPrsForCrash('regression-001');
    expect(edges).toHaveLength(1);
    expect(edges[0].to).toBe('pr:myorg/ios-app#432');
    expect(queryMock).toHaveBeenCalledWith(expect.stringContaining('introduced_by'), [
      'crash:regression-001',
    ]);
  });

  it('buildRelatedHistoryForCrash maps edges to history items', async () => {
    queryMock.mockResolvedValue({
      rows: [
        {
          from: 'crash:regression-001',
          to: 'pr:myorg/ios-app#432',
          relation: 'introduced_by',
          confidence: 0.88,
          source: 'rca-skill-v1',
          observed_at: new Date('2026-06-05'),
        },
      ],
    });

    const history = await buildRelatedHistoryForCrash('regression-001');
    expect(history[0]).toMatchObject({
      type: 'pr',
      ref: 'myorg/ios-app#432',
    });
  });
});
