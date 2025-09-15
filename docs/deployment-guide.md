# AlphoGenAI Deployment Guide

## Required Environment Variables

### Vercel Production Environment
Configure these in Vercel Dashboard > Project Settings > Environment Variables:

- `NEXT_PUBLIC_SUPABASE_URL`: https://abpbvhycqgvgpjvficff.supabase.co
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: [Supabase anon key]
- `SUPABASE_SERVICE_ROLE`: [Supabase service role key]
- `RUNPOD_API_KEY`: [Runpod API key]
- `RUNPOD_ENDPOINT_ID`: [Runpod endpoint ID]
- `WEBHOOK_SECRET`: [Webhook secret for Runpod]
- `NEXT_PUBLIC_BASE_URL`: https://app.alphogen.com

### GitHub Actions Secrets
Configure these in GitHub Repository Settings > Secrets and Variables > Actions:

- `SUPABASE_URL`: https://abpbvhycqgvgpjvficff.supabase.co
- `SUPABASE_ANON_KEY`: [Supabase anon key]
- `SUPABASE_SERVICE_ROLE`: [Supabase service role key]
- `SUPABASE_ACCESS_TOKEN`: [Supabase Management API PAT]
- `VERCEL_TOKEN`: [Vercel deployment token]
- `VERCEL_ORG_ID`: [Vercel organization ID]
- `VERCEL_PROJECT_ID`: [Vercel project ID]
- `RUNPOD_API_KEY`: [Runpod API key]
- `RUNPOD_ENDPOINT_ID`: [Runpod endpoint ID]
- `WEBHOOK_SECRET`: [Webhook secret for Runpod]

## Webhook Configuration
Configure Runpod webhook URL: https://app.alphogen.com/api/webhooks/runpod

## Test User
Stable test user for E2E testing: qa-user@mailinator.com / Test1234!

## Deployment Process

1. **Environment Variables**: Configure all required variables in Vercel and GitHub
2. **Database Migrations**: Automatically applied via CI/CD using Supabase Management API
3. **Deployment**: Automatic deployment to Vercel on main branch push
4. **E2E Testing**: Automated production testing after successful deployment

## API Endpoints

- `GET /api/health`: Health check
- `POST /api/jobs`: Create new job (requires authentication)
- `GET /api/jobs/:id`: Get job details (requires authentication)
- `POST /api/webhooks/runpod`: Runpod webhook handler (requires webhook secret)

## Testing Commands

```bash
# Test authentication
curl -X POST "https://abpbvhycqgvgpjvficff.supabase.co/auth/v1/token?grant_type=password" \
  -H "apikey: [SUPABASE_ANON_KEY]" \
  -H "Content-Type: application/json" \
  -d '{"email":"qa-user@mailinator.com","password":"Test1234!"}'

# Test job creation
curl -X POST "https://app.alphogen.com/api/jobs" \
  -H "Authorization: Bearer [ACCESS_TOKEN]" \
  -H "Content-Type: application/json" \
  -d '{"prompt":"Test video generation"}'

# Test webhook
curl -X POST "https://app.alphogen.com/api/webhooks/runpod" \
  -H "Content-Type: application/json" \
  -H "x-webhook-secret: [WEBHOOK_SECRET]" \
  -d '{"id":"[JOB_ID]","status":"COMPLETED","output":{"result_url":"https://example.com/result.mp4"}}'
```

## Troubleshooting

- **Migration Issues**: Check GitHub Actions logs for database migration job
- **Authentication Issues**: Verify Supabase environment variables are correctly configured
- **Webhook Issues**: Ensure webhook secret matches between Runpod and application
- **Deployment Issues**: Check Vercel deployment logs and environment variable configuration
