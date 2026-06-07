CREATE TABLE IF NOT EXISTS prd_review_runs (
  id TEXT PRIMARY KEY,
  prd_id TEXT NOT NULL,
  status TEXT NOT NULL,
  report JSONB,
  run_log JSONB,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_prd_review_runs_prd ON prd_review_runs(prd_id);
CREATE INDEX IF NOT EXISTS idx_prd_review_runs_status ON prd_review_runs(status);
