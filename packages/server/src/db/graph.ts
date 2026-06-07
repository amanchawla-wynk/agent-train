import type { GraphEdge, RelatedHistoryItem } from '@agent-train/shared';
import { getPool } from './pool.js';

function rowToEdge(row: {
  from: string;
  to: string;
  relation: string;
  confidence: number;
  source: string;
  observed_at: Date;
}): GraphEdge {
  return {
    from: row.from,
    to: row.to,
    relation: row.relation as GraphEdge['relation'],
    confidence: row.confidence,
    source: row.source,
    observedAt: row.observed_at.toISOString(),
  };
}

export async function getEdgesFrom(entityId: string): Promise<GraphEdge[]> {
  const db = getPool();
  const { rows } = await db.query(
    `SELECT "from", "to", relation, confidence, source, observed_at
     FROM edges WHERE "from" = $1 OR "to" = $1
     ORDER BY observed_at DESC`,
    [entityId],
  );
  return rows.map(rowToEdge);
}

export async function getRelatedPrsForCrash(crashGroupId: string): Promise<GraphEdge[]> {
  const db = getPool();
  const { rows } = await db.query(
    `SELECT "from", "to", relation, confidence, source, observed_at
     FROM edges
     WHERE "from" = $1 AND relation = 'introduced_by'
     ORDER BY confidence DESC, observed_at DESC`,
    [`crash:${crashGroupId}`],
  );
  return rows.map(rowToEdge);
}

export async function getCrashesLinkedToPr(
  repo: string,
  number: number,
): Promise<GraphEdge[]> {
  const db = getPool();
  const { rows } = await db.query(
    `SELECT "from", "to", relation, confidence, source, observed_at
     FROM edges
     WHERE "to" = $1 AND relation = 'introduced_by'
     ORDER BY observed_at DESC`,
    [`pr:${repo}#${number}`],
  );
  return rows.map(rowToEdge);
}

export async function buildRelatedHistoryForCrash(
  crashGroupId: string,
): Promise<RelatedHistoryItem[]> {
  const edges = await getRelatedPrsForCrash(crashGroupId);
  return edges.map((edge) => {
    const prRef = edge.to.replace(/^pr:/, '');
    return {
      type: 'pr' as const,
      ref: prRef,
      whyRelevant: `Prior RCA linked this crash to PR ${prRef} (confidence ${edge.confidence.toFixed(2)})`,
    };
  });
}
