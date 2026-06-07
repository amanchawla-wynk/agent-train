import type { GraphEdge } from '@agent-train/shared';
import { getPool } from './pool.js';

export async function insertEdges(edges: GraphEdge[]): Promise<void> {
  if (edges.length === 0) return;

  const db = getPool();
  const client = await db.connect();

  try {
    await client.query('BEGIN');
    for (const edge of edges) {
      await client.query(
        `INSERT INTO edges ("from", "to", relation, confidence, source, observed_at)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT ("from", "to", relation)
         DO UPDATE SET
           confidence = EXCLUDED.confidence,
           source = EXCLUDED.source,
           observed_at = EXCLUDED.observed_at`,
        [
          edge.from,
          edge.to,
          edge.relation,
          edge.confidence,
          edge.source,
          edge.observedAt,
        ],
      );
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
