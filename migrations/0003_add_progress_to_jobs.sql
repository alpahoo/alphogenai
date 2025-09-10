
ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS progress integer NOT NULL DEFAULT 0
    CHECK (progress >= 0 AND progress <= 100);

COMMENT ON COLUMN public.jobs.progress IS 'Job completion percentage (0-100)';
