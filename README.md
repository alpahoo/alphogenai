# AlphoGenAI

AI-powered video generation SaaS with Cloudflare Workers backend, Next.js frontend, and Stripe billing integration.

## Architecture

- **Frontend**: Next.js app deployed on Cloudflare Pages
- **Backend**: Cloudflare Worker with TypeScript
- **Storage**: Cloudflare R2 for assets
- **Database**: Supabase for user management and subscription tracking
- **AI Provider**: RunPod for video generation
- **Billing**: Stripe for subscription management
- **Infrastructure**: Pulumi for DNS, routes, and Pages project

## API Endpoints

### Core Endpoints

- `GET /health` - Health check
- `PUT /assets/:key` - Upload asset to R2 (requires auth)
- `GET /assets/:key` - Download asset from R2
- `POST /jobs` - Create video generation job (requires auth)
- `GET /jobs/:id` - Get job status (proxies RunPod)
- `POST /webhooks/test` - Test webhook endpoint
- `GET /me` - Get user profile (requires JWT)

### Billing Endpoints

- `POST /billing/checkout` - Create Stripe checkout session (requires JWT)
- `POST /webhooks/stripe` - Handle Stripe webhook events

### Authentication

- Bearer token authentication using `APP_ADMIN_TOKEN`
- JWT authentication via Supabase for `/me` and billing endpoints
- Webhook authentication using `X-Webhook-Secret` header
- Stripe webhook signature verification

## Frontend Pages

The Next.js frontend includes 6 main pages:

1. **Dashboard (/)** - API health status and quick actions
2. **Assets (/assets)** - File upload/download with cURL examples
3. **Jobs (/jobs)** - Video generation job management
4. **Webhooks (/webhooks)** - Webhook testing interface
5. **Account (/account)** - Supabase authentication and profile
6. **Billing (/billing)** - Stripe subscription management

## Environment Variables

### Worker Secrets
- `APP_ADMIN_TOKEN` - Admin authentication token
- `WEBHOOK_SECRET` - Webhook authentication secret
- `RUNPOD_API_KEY` - RunPod API key (optional)
- `RUNPOD_ENDPOINT_ID` - RunPod endpoint ID (optional)
- `SUPABASE_URL` - Supabase project URL (optional)
- `SUPABASE_SERVICE_ROLE` - Supabase service role key (optional)
- `STRIPE_SECRET_KEY` - Stripe secret key (optional)
- `STRIPE_WEBHOOK_SECRET` - Stripe webhook secret (optional)

### Frontend Environment Variables
- `NEXT_PUBLIC_API_BASE` - API base URL (default: https://api.alphogen.com)
- `NEXT_PUBLIC_SUPABASE_URL` - Supabase URL for client-side auth
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anonymous key

## Smoke Tests

### Exécution des tests

Les smoke tests vérifient automatiquement tous les endpoints de l'API. Pour les exécuter :

1. **Via GitHub Actions** (recommandé) :
   - Aller sur l'onglet "Actions" du repository
   - Sélectionner le workflow "API Smoke Tests"
   - Cliquer sur "Run workflow"

2. **Manuellement via curl** :
   ```bash
   # Test health
   curl -s https://api.alphogen.com/health
   
   # Test webhook (remplacer SECRET par la vraie valeur)
   curl -s -X POST https://api.alphogen.com/webhooks/test \
     -H "X-Webhook-Secret: SECRET" \
     -H "Content-Type: application/json" \
     -d '{"test": true}'
   
   # Test assets (remplacer TOKEN par la vraie valeur)
   curl -s -X PUT https://api.alphogen.com/assets/test.txt \
     -H "Authorization: Bearer TOKEN" \
     -H "Content-Type: text/plain" \
     -d "Hello World"
   
   curl -s https://api.alphogen.com/assets/test.txt
   
   # Test jobs (remplacer TOKEN par la vraie valeur)
   curl -s -X POST https://api.alphogen.com/jobs \
     -H "Authorization: Bearer TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"prompt": "test video"}'
   
   # Test job status (remplacer JOB_ID et TOKEN)
   curl -s https://api.alphogen.com/jobs/JOB_ID \
     -H "Authorization: Bearer TOKEN"
   ```

### Critères de succès

Les tests passent si :
- ✅ `GET /health` retourne `{"ok": true, ...}`
- ✅ `POST /webhooks/test` retourne `{"ok": true, ...}`
- ✅ `PUT/GET /assets` fonctionne correctement
- ✅ `POST /jobs` retourne un `provider_job_id`
- ✅ `GET /jobs/:id` retourne du JSON RunPod (pas d'erreur `supabase_not_configured`)

## Jobs – What to Expect

### POST /jobs Behavior

**Si secrets RunPod présents (RUNPOD_API_KEY + RUNPOD_ENDPOINT_ID):**
```bash
curl -X POST https://api.alphogen.com/jobs \
  -H "Authorization: Bearer <APP_ADMIN_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"prompt": "generate video of a cat"}'

# Response: 200 OK
{
  "ok": true,
  "status": "submitted",
  "provider": "runpod",
  "provider_job_id": "abc123-def456",
  "job_id": "uuid-from-database",
  "result": { /* RunPod response */ }
}
```

**Si secrets RunPod absents:**
```bash
# Same request
# Response: 202 Accepted
{
  "ok": true,
  "status": "submitted", 
  "provider": "noop",
  "provider_job_id": null,
  "job_id": "uuid-from-database"
}
```

### Database Integration

- Tous les jobs sont enregistrés dans `public.jobs` (Supabase)
- Status possibles: `queued`, `submitted`, `error`, `noop`
- Les webhooks sont loggés dans `public.events`
- JWT validation via Supabase Auth pour `/me`

### GET /me Endpoint

**Avec JWT valide:**
```bash
curl https://api.alphogen.com/me \
  -H "Authorization: Bearer <SUPABASE_JWT>"

# Response: 200 OK
{
  "ok": true,
  "user": {
    "id": "user-uuid",
    "email": "user@example.com"
  }
}
```

**Si Supabase non configuré:**
```bash
# Response: 501 Not Implemented
{
  "ok": true,
  "provider": "noop",
  "message": "supabase_not_configured"
}
```

## Configuration des Secrets

### GitHub Secrets (pour CI/CD)

Les secrets suivants doivent être configurés dans GitHub Actions :

- `APP_ADMIN_TOKEN` - Token d'administration pour l'API
- `WEBHOOK_SECRET` - Secret pour valider les webhooks
- `RUNPOD_API_KEY` - Clé API RunPod
- `RUNPOD_ENDPOINT_ID` - ID de l'endpoint RunPod
- `SUPABASE_URL` - URL de l'instance Supabase
- `SUPABASE_SERVICE_ROLE` - Clé service role Supabase
- `CF_API_TOKEN` - Token API Cloudflare (pour déploiement)
- `PULUMI_ACCESS_TOKEN` - Token Pulumi (pour infrastructure)

### Cloudflare Worker Secrets

Les secrets sont automatiquement synchronisés depuis GitHub vers le Worker lors du déploiement via les workflows CI/CD :

- `APP_ADMIN_TOKEN` → Worker environment
- `WEBHOOK_SECRET` → Worker environment  
- `RUNPOD_API_KEY` → Worker environment
- `RUNPOD_ENDPOINT_ID` → Worker environment
- `SUPABASE_URL` → Worker environment
- `SUPABASE_SERVICE_ROLE` → Worker environment

## Runbook - Dépannage 5 minutes

### 1. Vérifier l'état de l'API
```bash
curl -s https://api.alphogen.com/health
# Doit retourner: {"ok":true,"ts":...}
```

### 2. Problème "supabase_not_configured"
Si `GET /jobs/:id` retourne cette erreur :
1. Vérifier que les secrets `RUNPOD_API_KEY` et `RUNPOD_ENDPOINT_ID` sont configurés dans GitHub
2. Redéployer le Worker pour synchroniser les secrets :
   ```bash
   # Dans le dossier workers/
   wrangler secret put RUNPOD_API_KEY
   wrangler secret put RUNPOD_ENDPOINT_ID
   wrangler deploy
   ```

### 3. Problème d'authentification
Si les endpoints retournent `{"ok":false,"error":"unauthorized"}` :
1. Vérifier que le token `APP_ADMIN_TOKEN` est correct
2. Vérifier le format du header : `Authorization: Bearer <token>`

### 4. Problème de webhook
Si `/webhooks/test` échoue :
1. Vérifier que le secret `WEBHOOK_SECRET` est correct
2. Vérifier le format du header : `X-Webhook-Secret: <secret>`

### 5. Vérifier les logs Worker
```bash
wrangler tail --env prod
```

### 6. Vérifier la configuration des routes
La route `api.alphogen.com/*` doit pointer vers le Worker `alphogenai-worker`.

## Database Setup (Supabase)

### Required SQL Migrations

Execute these SQL commands in your Supabase SQL editor:

```sql
create extension if not exists "uuid-ossp";

-- Jobs table for tracking RunPod job submissions
create table if not exists public.jobs (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid, 
  status text default 'queued',
  payload jsonb, 
  result jsonb, 
  created_at timestamptz default now()
);

-- Events table for webhook and system event logging
create table if not exists public.events (
  id bigserial primary key, 
  type text not null,
  payload jsonb, 
  created_at timestamptz default now()
);

-- Row Level Security for jobs
alter table public.jobs enable row level security;
create policy "job_owner_can_read" on public.jobs for select using (auth.uid() = user_id);
create policy "job_owner_can_insert" on public.jobs for insert with check (auth.uid() = user_id);

-- Allow service role to manage all records (for API operations)
create policy "service_role_all_jobs" on public.jobs for all using (auth.role() = 'service_role');
create policy "service_role_all_events" on public.events for all using (auth.role() = 'service_role');
```

### Database Schema

**jobs table:**
- `id`: UUID primary key
- `user_id`: UUID of authenticated user (nullable for admin operations)
- `status`: Job status (`queued`, `submitted`, `noop`, `error`)
- `payload`: Original job request data
- `result`: Job result including provider info and response
- `created_at`: Timestamp

**events table:**
- `id`: Auto-incrementing primary key
- `type`: Event type (webhook path like `/webhooks/test`)
- `payload`: Event data including headers and body
- `created_at`: Timestamp

## Architecture

- **Frontend** : Next.js déployé sur Cloudflare Pages
- **API** : Cloudflare Worker (`workers/src/index.ts`)
- **Infrastructure** : Pulumi pour la gestion Cloudflare
- **Génération vidéo** : RunPod API
- **Database** : Supabase (PostgreSQL)
- **Storage** : Cloudflare R2

## Development

### Local Development

1. **Worker Development**:
   ```bash
   cd workers
   npm install
   cp .dev.vars.example .dev.vars  # Configure your secrets
   npm run dev
   ```

2. **Frontend Development**:
   ```bash
   cd app
   npm install
   npm run dev
   ```

### Testing

Run smoke tests to verify all endpoints:
```bash
# Health check
curl https://api.alphogen.com/health

# Webhook test
curl -X POST https://api.alphogen.com/webhooks/test \
  -H "X-Webhook-Secret: YOUR_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"test": true}'

# Asset upload/download
curl -X PUT https://api.alphogen.com/assets/test.txt \
  -H "Authorization: Bearer YOUR_TOKEN" \
  --data "test content"
curl https://api.alphogen.com/assets/test.txt

# Job creation
curl -X POST https://api.alphogen.com/jobs \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"prompt": "test video"}'

# User profile
curl https://api.alphogen.com/me \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Billing checkout
curl -X POST https://api.alphogen.com/billing/checkout \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"price_id": "price_pro_monthly"}'
```

### Deployment

The project uses GitHub Actions for CI/CD:

1. **Staging**: Pushes to `main` trigger staging deployment
2. **Production**: Pushes to `prod` trigger production deployment

## Stripe Integration

### Setup

1. Create Stripe account and get API keys
2. Configure webhook endpoint: `https://api.alphogen.com/webhooks/stripe`
3. Set webhook events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`
4. Add secrets to GitHub and Cloudflare Worker

### Database Schema

Create `user_subscriptions` table in Supabase:
```sql
CREATE TABLE user_subscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id TEXT NOT NULL,
  subscription_id TEXT,
  status TEXT NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

## Troubleshooting

### Common Issues

1. **"supabase_not_configured" errors**: Configure `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE` secrets
2. **"runpod_not_configured" responses**: Configure `RUNPOD_API_KEY` and `RUNPOD_ENDPOINT_ID` secrets
3. **"stripe_not_configured" responses**: Configure `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` secrets
4. **Asset upload failures**: Verify R2 bucket binding and permissions
5. **CORS errors**: Check that frontend domain is in allowed origins
6. **Smoke test failures**: Check that all GitHub secrets are properly configured

### Logs and Monitoring

- Worker logs: `wrangler tail` or Cloudflare Dashboard
- Pages logs: Cloudflare Dashboard > Pages > Functions
- CI/CD logs: GitHub Actions tab
- Stripe events: Stripe Dashboard > Webhooks

### Smoke Tests

The project includes automated smoke tests that run after deployment:
- Tests all core endpoints including billing
- Adapts to available secrets (graceful noop responses for missing integrations)
- Provides clear success/failure feedback
- Includes retry logic for CI environment stability

## API Examples

### Upload and Download Asset
```bash
# Upload
curl -X PUT "https://api.alphogen.com/assets/example.txt" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: text/plain" \
  --data "Hello World"

# Download
curl "https://api.alphogen.com/assets/example.txt"
```

### Create and Check Job
```bash
# Create job
curl -X POST "https://api.alphogen.com/jobs" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"prompt": "A beautiful sunset over mountains"}'

# Check status
curl "https://api.alphogen.com/jobs/JOB_ID" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Test Webhook
```bash
curl -X POST "https://api.alphogen.com/webhooks/test" \
  -H "X-Webhook-Secret: YOUR_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"test": true}'
```

### Billing Integration
```bash
# Create checkout session
curl -X POST "https://api.alphogen.com/billing/checkout" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "price_id": "price_pro_monthly",
    "success_url": "https://yourapp.com/billing?success=true",
    "cancel_url": "https://yourapp.com/billing?canceled=true"
  }'

# Webhook endpoint (handled automatically by Stripe)
curl -X POST "https://api.alphogen.com/webhooks/stripe" \
  -H "stripe-signature: STRIPE_SIGNATURE" \
  -H "Content-Type: application/json" \
  -d 'STRIPE_WEBHOOK_PAYLOAD'
```

### User Profile
```bash
curl "https://api.alphogen.com/me" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## Graceful Fallbacks

The API provides graceful "noop" responses when optional services are not configured:

- **RunPod not configured**: `POST /jobs` returns `{"ok": true, "provider": "noop", "message": "runpod_not_configured"}`
- **Supabase not configured**: `GET /me` returns `{"ok": true, "provider": "noop", "message": "supabase_not_configured"}`
- **Stripe not configured**: Billing endpoints return `{"ok": true, "provider": "noop", "message": "stripe_not_configured"}`

This allows the application to function and be tested even with partial configuration.

## License

MIT
