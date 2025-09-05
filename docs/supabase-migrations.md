# Supabase Database Migrations

This document provides instructions for applying database migrations to the Supabase instance.

## Manual Migration Process

Since Supabase CLI is not configured in the CI/CD pipeline, migrations must be applied manually through the Supabase dashboard.

### Steps to Apply Migrations

1. **Access Supabase Dashboard**
   - Go to https://app.supabase.com
   - Navigate to your AlphoGenAI project
   - Go to the SQL Editor

2. **Apply Initial Schema Migration**
   - Copy the contents of `supabase/migrations/001_initial_schema.sql`
   - Paste into the SQL Editor
   - Execute the migration

3. **Verify Tables Created**
   - Check that the following tables exist:
     - `public.users` (with UUID primary key, email, password_hash)
     - `public.jobs` (with UUID primary key, user_id foreign key, prompt, status, etc.)
   - Verify that RLS (Row Level Security) is enabled on both tables

4. **Verify RLS Policies**
   - Confirm that service_role policies allow full access for Worker API
   - Confirm that user policies allow appropriate access for authenticated users
   - Test that users can only access their own data

### Migration Contents

The `001_initial_schema.sql` migration includes:

- **Tables**: `users`, `jobs` with proper UUID primary keys and relationships
- **Indexes**: Optimized indexes for common queries (user_id, status, created_at)
- **RLS Policies**: Service role access for Worker API, user isolation for regular users
- **Extensions**: UUID generation extension for primary keys

### Verification Commands

After applying migrations, verify the setup:

```sql
-- Check tables exist
SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';

-- Check RLS is enabled
SELECT schemaname, tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public';

-- Check policies exist
SELECT schemaname, tablename, policyname FROM pg_policies WHERE schemaname = 'public';
```

### Troubleshooting

If migrations fail:

1. **Permission Issues**: Ensure you have admin access to the Supabase project
2. **Existing Tables**: Drop existing tables if they conflict with the migration
3. **RLS Conflicts**: Disable RLS temporarily if policies conflict during migration
4. **UUID Extension**: Ensure the `uuid-ossp` extension is available in your Supabase instance

### Environment Variables

Ensure these environment variables are configured in GitHub Secrets:

- `SUPABASE_URL`: Your Supabase project URL
- `SUPABASE_SERVICE_ROLE`: Service role key for Worker API access
- `SUPABASE_ANON_KEY`: Anonymous key for frontend access
