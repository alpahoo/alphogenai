CREATE TABLE IF NOT EXISTS public.jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  prompt text NOT NULL,
  status text CHECK (status IN ('queued','running','done','error')) DEFAULT 'queued',
  progress integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS runpod_job_id text;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS result_key text;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS error_message text;

ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'jobs' AND policyname = 'Users can view their own jobs'
  ) THEN
    CREATE POLICY "Users can view their own jobs"
    ON public.jobs FOR SELECT
    USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'jobs' AND policyname = 'Users can insert their own jobs'
  ) THEN
    CREATE POLICY "Users can insert their own jobs"
    ON public.jobs FOR INSERT
    WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'jobs' AND policyname = 'Users can update their own jobs'
  ) THEN
    CREATE POLICY "Users can update their own jobs"
    ON public.jobs FOR UPDATE
    USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'jobs' AND policyname = 'Service role full access'
  ) THEN
    CREATE POLICY "Service role full access"
    ON public.jobs FOR ALL
    USING (auth.role() = 'service_role');
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_jobs_user_id ON public.jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON public.jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_runpod_job_id ON public.jobs(runpod_job_id);

NOTIFY pgrst, 'reload schema';
