ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS runpod_job_id text,
  ADD COLUMN IF NOT EXISTS error_message text;

CREATE INDEX IF NOT EXISTS idx_jobs_runpod_job_id ON public.jobs(runpod_job_id);

NOTIFY pgrst, 'reload schema';
