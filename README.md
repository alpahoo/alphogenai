# AlphoGenAI - Générateur de vidéos IA

AlphoGenAI est un SaaS de génération de vidéos IA utilisant Cloudflare Workers et RunPod.

## URLs & Branches

| Environment | Branch | API URL | Pages URL | Pulumi Stack |
|-------------|--------|---------|-----------|--------------|
| Staging | `main` | https://api-staging.alphogen.com (pending deployment) | https://alphogenai-app-staging.pages.dev | staging |
| Production | `prod` | https://api.alphogen.com | https://alphogenai-app.pages.dev | prod |

**Note**: Currently testing against production API (api.alphogen.com) until staging infrastructure is deployed.

## API Endpoints

L'API est disponible avec les endpoints suivants :

- `GET /health` - Vérification de santé de l'API
- `POST /webhooks/test` - Test des webhooks (nécessite header `X-Webhook-Secret`)
- `PUT /assets/<key>` - Upload d'assets (nécessite header `Authorization: Bearer <APP_ADMIN_TOKEN>`)
- `GET /assets/<key>` - Récupération d'assets (support `?download=1` pour téléchargement)
- `POST /jobs` - Création d'un job de génération vidéo (nécessite header `Authorization: Bearer <APP_ADMIN_TOKEN>`)
- `GET /jobs/:id` - Récupération du statut d'un job (proxy vers RunPod API)
- `GET /me` - Validation JWT utilisateur (nécessite header `Authorization: Bearer <JWT_TOKEN>`)

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

## Développement

```bash
# Installation des dépendances Worker
cd workers && npm install

# Développement local
npm run dev

# Déploiement
npm run deploy

# Tests de type
npm run typecheck
```
