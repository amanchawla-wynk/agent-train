import type { PrdGapReport } from '@agent-train/shared';
import type { PrdGapRunLog } from '@agent-train/agents';
import { getPool } from './pool.js';

export type PrdReviewRunStatus =
  | 'queued'
  | 'running'
  | 'completed'
  | 'failed'
  | 'budget_exceeded';

export interface PrdReviewRunRecord {
  id: string;
  prdId: string;
  status: PrdReviewRunStatus;
  report: PrdGapReport | null;
  runLog: PrdGapRunLog | null;
  error: string | null;
  createdAt: string;
  completedAt: string | null;
}

function rowToRecord(row: {
  id: string;
  prd_id: string;
  status: string;
  report: PrdGapReport | null;
  run_log: PrdGapRunLog | null;
  error: string | null;
  created_at: Date;
  completed_at: Date | null;
}): PrdReviewRunRecord {
  return {
    id: row.id,
    prdId: row.prd_id,
    status: row.status as PrdReviewRunStatus,
    report: row.report,
    runLog: row.run_log,
    error: row.error,
    createdAt: row.created_at.toISOString(),
    completedAt: row.completed_at?.toISOString() ?? null,
  };
}

export async function createPrdReviewRun(
  id: string,
  prdId: string,
): Promise<PrdReviewRunRecord> {
  const db = getPool();
  const { rows } = await db.query(
    `INSERT INTO prd_review_runs (id, prd_id, status)
     VALUES ($1, $2, 'queued')
     RETURNING *`,
    [id, prdId],
  );
  return rowToRecord(rows[0]);
}

export async function updatePrdReviewRun(
  id: string,
  patch: {
    status?: PrdReviewRunStatus;
    report?: PrdGapReport | null;
    runLog?: PrdGapRunLog | null;
    error?: string | null;
    completedAt?: string | null;
  },
): Promise<PrdReviewRunRecord | null> {
  const db = getPool();
  const sets: string[] = [];
  const values: unknown[] = [];
  let i = 1;

  if (patch.status !== undefined) {
    sets.push(`status = $${i++}`);
    values.push(patch.status);
  }
  if (patch.report !== undefined) {
    sets.push(`report = $${i++}`);
    values.push(patch.report ? JSON.stringify(patch.report) : null);
  }
  if (patch.runLog !== undefined) {
    sets.push(`run_log = $${i++}`);
    values.push(patch.runLog ? JSON.stringify(patch.runLog) : null);
  }
  if (patch.error !== undefined) {
    sets.push(`error = $${i++}`);
    values.push(patch.error);
  }
  if (patch.completedAt !== undefined) {
    sets.push(`completed_at = $${i++}`);
    values.push(patch.completedAt);
  }

  if (sets.length === 0) return getPrdReviewRun(id);

  values.push(id);
  const { rows } = await db.query(
    `UPDATE prd_review_runs SET ${sets.join(', ')} WHERE id = $${i} RETURNING *`,
    values,
  );
  return rows[0] ? rowToRecord(rows[0]) : null;
}

export async function getPrdReviewRun(id: string): Promise<PrdReviewRunRecord | null> {
  const db = getPool();
  const { rows } = await db.query('SELECT * FROM prd_review_runs WHERE id = $1', [id]);
  return rows[0] ? rowToRecord(rows[0]) : null;
}
