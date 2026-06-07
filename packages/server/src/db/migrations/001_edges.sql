CREATE TABLE IF NOT EXISTS edges (
  id SERIAL PRIMARY KEY,
  "from" TEXT NOT NULL,
  "to" TEXT NOT NULL,
  relation TEXT NOT NULL,
  confidence REAL NOT NULL,
  source TEXT NOT NULL,
  observed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE ("from", "to", relation)
);
