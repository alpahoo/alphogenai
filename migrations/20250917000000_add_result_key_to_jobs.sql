ALTER TABLE public.jobs 
ADD COLUMN IF NOT EXISTS result_key text;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'jobs' AND column_name = 'result_r2_key'
  ) THEN
    UPDATE public.jobs 
    SET result_key = result_r2_key 
    WHERE result_key IS NULL AND result_r2_key IS NOT NULL;
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
