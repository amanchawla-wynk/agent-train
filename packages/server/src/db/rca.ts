import type { RcaReport } from '@agent-train/shared';
import type { RcaRunLog } from '@agent-train/agents';
import { getPool } from './pool.js';

export type RcaRunStatus =
  | 'queued'
  | 'running'
  | 'completed'
  | 'failed'
  | 'budget_exceeded';

export interface RcaRunRecord {
  id: string;
  crashGroupId: string;
  appId: string;
  status: RcaRunStatus;
  report: RcaReport | null;
  runLog: RcaRunLog | null;
  error: string | null;
  createdAt: string;
  completedAt: string | null;
}

function rowToRecord(row: {
  id: string;
  crash_group_id: string;
  app_id: string;
  status: string;
  report: RcaReport | null;
  run_log: RcaRunLog | null;
  error: string | null;
  created_at: Date;
  completed_at: Date | null;
}): RcaRunRecord {
  return {
    id: row.id,
    crashGroupId: row.crash_group_id,
    appId: row.app_id,
    status: row.status as RcaRunStatus,
    report: row.report,
    runLog: row.run_log,
    error: row.error,
    createdAt: row.created_at.toISOString(),
    completedAt: row.completed_at?.toISOString() ?? null,
  };
}

export async function createRun(
  id: string,
  crashGroupId: string,
  appId: string,
): Promise<RcaRunRecord> {
  const db = getPool();
  const { rows } = await db.query(
    `INSERT INTO rca_runs (id, crash_group_id, app_id, status)
     VALUES ($1, $2, $3, 'queued')
     RETURNING *`,
    [id, crashGroupId, appId],
  );
  return rowToRecord(rows[0]);
}

export async function updateRun(
  id: string,
  patch: {
    status?: RcaRunStatus;
    report?: RcaReport | null;
    runLog?: RcaRunLog | null;
    error?: string | null;
    completedAt?: string | null;
  },
): Promise<RcaRunRecord | null> {
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

  if (sets.length === 0) return getRun(id);

  values.push(id);
  const { rows } = await db.query(
    `UPDATE rca_runs SET ${sets.join(', ')} WHERE id = $${i} RETURNING *`,
    values,
  );
  return rows[0] ? rowToRecord(rows[0]) : null;
}

export async function getRun(id: string): Promise<RcaRunRecord | null> {
  const db = getPool();
  const { rows } = await db.query('SELECT * FROM rca_runs WHERE id = $1', [id]);
  return rows[0] ? rowToRecord(rows[0]) : null;
}
