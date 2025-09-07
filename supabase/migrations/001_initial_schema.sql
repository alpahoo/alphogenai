CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  prompt text NOT NULL,
  status text CHECK (status IN ('queued','running','done','error')) DEFAULT 'queued',
  progress int DEFAULT 0,
  result_r2_key text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE jobs DROP CONSTRAINT IF EXISTS jobs_user_id_fkey;
ALTER TABLE jobs
  ADD CONSTRAINT jobs_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_jobs_user_id ON jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_created_at ON jobs(created_at DESC);

ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;

-- Service role policies for Worker API access (idempotent)
DROP POLICY IF EXISTS "Service role full access jobs" ON jobs;
CREATE POLICY "Service role full access jobs" ON jobs
    FOR ALL USING (
        auth.role() = 'service_role'
    );

DROP POLICY IF EXISTS "Users can view own jobs" ON jobs;
CREATE POLICY "Users can view own jobs" ON jobs
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create own jobs" ON jobs;
CREATE POLICY "Users can create own jobs" ON jobs
    FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own jobs" ON jobs;
CREATE POLICY "Users can update own jobs" ON jobs
    FOR UPDATE USING (auth.uid() = user_id);
