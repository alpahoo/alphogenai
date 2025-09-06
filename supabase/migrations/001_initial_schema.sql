CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    prompt TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'processing', 'completed', 'failed')),
    result_url TEXT,
    error_message TEXT,
    runpod_job_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_jobs_user_id ON public.jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON public.jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_created_at ON public.jobs(created_at DESC);

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;

-- Service role policies for Worker API access (idempotent)
DROP POLICY IF EXISTS "Service role full access users" ON public.users;
CREATE POLICY "Service role full access users" ON public.users
    FOR ALL USING (
        auth.role() = 'service_role'
    );

DROP POLICY IF EXISTS "Service role full access jobs" ON public.jobs;
CREATE POLICY "Service role full access jobs" ON public.jobs
    FOR ALL USING (
        auth.role() = 'service_role'
    );

DROP POLICY IF EXISTS "Users can view own data" ON public.users;
CREATE POLICY "Users can view own data" ON public.users
    FOR SELECT USING (auth.uid()::text = id::text);

DROP POLICY IF EXISTS "Users can update own data" ON public.users;
CREATE POLICY "Users can update own data" ON public.users
    FOR UPDATE USING (auth.uid()::text = id::text);

DROP POLICY IF EXISTS "Users can view own jobs" ON public.jobs;
CREATE POLICY "Users can view own jobs" ON public.jobs
    FOR SELECT USING (auth.uid()::text = user_id::text);

DROP POLICY IF EXISTS "Users can create own jobs" ON public.jobs;
CREATE POLICY "Users can create own jobs" ON public.jobs
    FOR INSERT WITH CHECK (auth.uid()::text = user_id::text);

DROP POLICY IF EXISTS "Users can update own jobs" ON public.jobs;
CREATE POLICY "Users can update own jobs" ON public.jobs
    FOR UPDATE USING (auth.uid()::text = user_id::text);
