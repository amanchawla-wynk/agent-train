CREATE TABLE IF NOT EXISTS rca_runs (
  id TEXT PRIMARY KEY,
  crash_group_id TEXT NOT NULL,
  app_id TEXT NOT NULL,
  status TEXT NOT NULL,
  report JSONB,
  run_log JSONB,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_rca_runs_crash ON rca_runs(crash_group_id);
CREATE INDEX IF NOT EXISTS idx_rca_runs_status ON rca_runs(status);
