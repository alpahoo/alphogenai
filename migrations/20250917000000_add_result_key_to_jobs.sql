ALTER TABLE public.jobs 
ADD COLUMN IF NOT EXISTS result_key text;

UPDATE public.jobs 
SET result_key = result_r2_key 
WHERE result_key IS NULL AND result_r2_key IS NOT NULL;

NOTIFY pgrst, 'reload schema';
