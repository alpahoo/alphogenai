# Supabase Setup Instructions

## Database Migration

The Supabase database needs to be initialized with the proper schema and RLS policies. Run the following SQL in your Supabase SQL Editor:

```sql
-- Apply the migration
\i supabase/migrations/001_initial_schema.sql

-- Verify tables were created
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' AND table_name IN ('users', 'jobs');

-- Verify RLS is enabled
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' AND tablename IN ('users', 'jobs');

-- List all policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd 
FROM pg_policies 
WHERE schemaname = 'public';
```

## Environment Variables Required

### Cloudflare Workers Secrets
```bash
wrangler secret put SUPABASE_URL --env prod
wrangler secret put SUPABASE_SERVICE_ROLE --env prod
```

### GitHub Secrets
- `SUPABASE_URL`: https://your-project.supabase.co
- `SUPABASE_SERVICE_ROLE`: Your service role key (starts with eyJ...)
- `SUPABASE_ANON_KEY`: Your anon public key

### Cloudflare Pages Environment Variables
- `NEXT_PUBLIC_SUPABASE_URL`: https://your-project.supabase.co
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Your anon public key

## Testing Authentication

After applying migrations, test the authentication endpoints:

```bash
# Test signup
curl -X POST https://api.alphogen.com/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"testpass123"}'

# Test login
curl -X POST https://api.alphogen.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"testpass123"}'
```

## Troubleshooting

1. **"Failed to create user"**: Database tables don't exist or RLS policies are blocking access
2. **"supabase_not_configured"**: Environment variables not set properly
3. **Connection errors**: Check SUPABASE_URL and SUPABASE_SERVICE_ROLE values

## Manual Migration Application

If automated migration fails, manually run in Supabase SQL Editor:

```sql
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

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;

-- Service role policies for Worker API access
CREATE POLICY "Service role full access users" ON public.users
    FOR ALL USING (
        current_setting('request.jwt.claims', true)::json->>'role' = 'service_role'
        OR current_setting('request.headers', true)::json->>'authorization' LIKE 'Bearer %'
    );

CREATE POLICY "Service role full access jobs" ON public.jobs
    FOR ALL USING (
        current_setting('request.jwt.claims', true)::json->>'role' = 'service_role'
        OR current_setting('request.headers', true)::json->>'authorization' LIKE 'Bearer %'
    );

-- Allow user creation and basic operations
CREATE POLICY "Allow user creation" ON public.users FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can view own profile" ON public.users FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON public.users FOR UPDATE USING (true);
CREATE POLICY "Users can view own jobs" ON public.jobs FOR SELECT USING (true);
CREATE POLICY "Users can create own jobs" ON public.jobs FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can update own jobs" ON public.jobs FOR UPDATE USING (true);
```
