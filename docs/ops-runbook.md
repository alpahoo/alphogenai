# AlphoGenAI Operations Runbook

## Environment Variables Configuration

### GitHub Secrets (Required for CI/CD)
```
CF_API_TOKEN=your_cloudflare_api_token
JWT_SECRET=your_jwt_secret_key
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE=your_supabase_service_role_key
SUPABASE_ANON_KEY=your_supabase_anon_key
RUNPOD_API_KEY=your_runpod_api_key
RUNPOD_ENDPOINT_ID=your_runpod_endpoint_id
RUNPOD_TEMPLATE_ID=your_runpod_template_id
```

### Cloudflare Workers Secrets
```bash
# Deploy secrets to production Worker
wrangler secret put JWT_SECRET --env prod
wrangler secret put SUPABASE_URL --env prod
wrangler secret put SUPABASE_SERVICE_ROLE --env prod
wrangler secret put RUNPOD_API_KEY --env prod
wrangler secret put RUNPOD_ENDPOINT_ID --env prod
```

### Cloudflare Pages Environment Variables
```
NEXT_PUBLIC_API_BASE=https://api.alphogen.com
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### Runpod Runner Environment Variables
```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE=your_supabase_service_role_key
WAN_API_KEY=your_wan_api_key
QWEN_API_KEY=your_qwen_api_key
R2_ENDPOINT=https://your-account-id.r2.cloudflarestorage.com
R2_ACCESS_KEY=your_r2_access_key
R2_SECRET_KEY=your_r2_secret_key
R2_BUCKET=alphogenai-assets
```

## Database Setup

### Apply Supabase Migrations
```sql
-- Run in Supabase SQL Editor
\i supabase/migrations/001_initial_schema.sql
\i supabase/seed.sql
```

### Verify RLS Policies
```sql
-- Check RLS is enabled
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' AND rowsecurity = true;

-- List policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE schemaname = 'public';
```

## Deployment Commands

### Manual Deployment
```bash
# Deploy Worker API
cd workers && wrangler deploy --env prod

# Deploy Frontend
cd app && npm run build && npx wrangler pages deploy ./out --project-name alphogenai-app

# Deploy Runner (requires Runpod setup)
cd runner && docker build -t alphogenai-runner .
```

### Smoke Tests
```bash
# Run e2e tests
.github/workflows/e2e-tests.yml

# Manual API tests
curl https://api.alphogen.com/health
curl -X POST https://api.alphogen.com/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"testpass123"}'
```

## Troubleshooting

### Common Issues

1. **Supabase Auth Errors**
   - Check SUPABASE_URL and SUPABASE_SERVICE_ROLE are correct
   - Verify RLS policies allow service_role access
   - Check database tables exist

2. **Runpod Job Failures**
   - Verify RUNPOD_API_KEY and RUNPOD_ENDPOINT_ID
   - Check Runpod endpoint is active
   - Review runner logs for API errors

3. **R2 Upload Failures**
   - Verify R2 bucket exists and is accessible
   - Check R2 credentials and endpoint URL
   - Ensure bucket has proper CORS settings

### Log Locations
- Worker API: Cloudflare Workers dashboard
- Frontend: Cloudflare Pages dashboard
- Runner: Runpod logs dashboard
- CI/CD: GitHub Actions logs

## Monitoring

### Health Checks
- API Health: `GET https://api.alphogen.com/health`
- Frontend: `GET https://alphogenai-app.pages.dev`
- Database: Supabase dashboard metrics

### Key Metrics
- Job completion rate
- Video generation time
- API response times
- Error rates by component

## Security

### Secret Rotation
1. Generate new secret
2. Update in GitHub Secrets
3. Deploy to update Worker/Pages
4. Verify functionality
5. Remove old secret

### Access Control
- Supabase RLS policies enforce user isolation
- Worker API validates JWT tokens
- R2 bucket has restricted access
- Runpod endpoint secured with API key
