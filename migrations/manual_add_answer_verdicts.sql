ALTER TABLE answers ADD COLUMN IF NOT EXISTS verdict_correctness text;
ALTER TABLE answers ADD COLUMN IF NOT EXISTS verdict_groundedness text;
ALTER TABLE answers ADD COLUMN IF NOT EXISTS verdict_reason text;
ALTER TABLE answers ADD COLUMN IF NOT EXISTS provider text;
ALTER TABLE answers ADD COLUMN IF NOT EXISTS run_index integer DEFAULT 0;
