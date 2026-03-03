# CLAUDE.md — AlphoGenAI

Guide de développement pour les agents IA travaillant sur ce projet.

## Présentation

**AlphoGenAI** est une plateforme SaaS de génération vidéo IA.
- **Owner GitHub :** alpahoo
- **Repo principal :** alpahoo/alphogenai

---

## Stack technique

| Couche | Technologie |
|--------|-------------|
| Frontend | Next.js (App Router) + TypeScript |
| UI | Tailwind CSS + Radix UI + shadcn/ui |
| Auth + DB | Supabase (Auth, PostgreSQL, Storage) |
| ORM | Drizzle ORM |
| Job Queue | Inngest |
| GPU Inference | Modal (Python) |
| Modèles vidéo | Long Video Infinity (LVI), Seedance 2.0 |
| Stockage vidéo | Cloudflare R2 (S3-compatible) |
| CDN | Cloudflare R2 public URL |
| Déploiement | Vercel |
| Monitoring | Sentry + Spotlight (dev) |
| Tests | Vitest (unit) + Playwright (e2e) + Storybook |
| Lint/Format | ESLint (@antfu/eslint-config) + commitlint |
| Paiements | Stripe |
| Logging | Pino + Logtail |

---

## Structure du projet

```
src/
├── app/              # Next.js App Router — pages et API routes
├── components/       # Composants UI réutilisables
├── contexts/         # React contexts
├── features/         # Logique métier par feature (video, auth, billing…)
├── hooks/            # Custom React hooks
├── libs/             # Clients externes (supabase, stripe, modal…)
├── locales/          # i18n
├── models/           # Types et modèles de données
├── styles/           # CSS global
├── templates/        # Templates de pages
├── types/            # Types TypeScript partagés
└── utils/            # Utilitaires
migrations/           # Migrations Drizzle
scripts/              # Scripts utilitaires
```

---

## Variables d'environnement

### Supabase
```env
NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon_key>
SUPABASE_SERVICE_ROLE_KEY=<service_role_key>   # server-side uniquement
```

### Modal
```env
MODAL_TOKEN_ID=ak-<id>
MODAL_TOKEN_SECRET=as-<secret>
```

### Cloudflare R2
```env
CLOUDFLARE_ACCOUNT_ID=<account_id>
R2_ACCESS_KEY_ID=<access_key>
R2_SECRET_ACCESS_KEY=<secret_key>
R2_BUCKET_NAME=alphogenai-assets
R2_ENDPOINT=https://<account_id>.r2.cloudflarestorage.com
R2_PUBLIC_URL=<public_url>                     # si domaine custom activé
```

### Inngest
```env
INNGEST_EVENT_KEY=<event_key>
INNGEST_SIGNING_KEY=signkey-prod-<key>
```

### Stripe
```env
STRIPE_SECRET_KEY=sk_live_<key>
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_<key>
STRIPE_WEBHOOK_SECRET=whsec_<key>
```

### OpenRouter (fallback LLM)
```env
OPENROUTER_API_KEY=sk-or-v1-<key>
```

---

## Commandes essentielles

```bash
# Dev
npm run dev              # Next.js + Spotlight

# Build & vérifs
npm run build
npm run check-types
npm run lint
npm run lint:fix

# Tests
npm run test             # Vitest unit
npm run test:e2e         # Playwright e2e

# DB (Drizzle)
npm run db:generate      # Générer les migrations
npm run db:migrate       # Appliquer les migrations
npm run db:studio        # Drizzle Studio UI

# Storybook
npm run storybook
```

---

## Conventions de code

### TypeScript
- TypeScript strict — pas de `any` implicite
- Exports nommés préférés aux exports default
- Types dans `src/types/` ou co-localisés avec le fichier

### Composants React
- Composants fonctionnels uniquement
- Props typées explicitement (pas d'inférence implicite)
- shadcn/ui pour les composants UI de base

### Structure features
Chaque feature dans `src/features/<feature>/` contient :
```
actions/     # Server Actions Next.js
components/  # Composants propres à la feature
hooks/       # Hooks propres à la feature
types.ts     # Types de la feature
```

### Commits
- Format Conventional Commits : `feat:`, `fix:`, `chore:`, `docs:`
- Commitlint configuré — utiliser `npm run commit`

### API Routes
- Utiliser les Route Handlers Next.js (`app/api/`)
- Valider les inputs avec zod
- Retourner des erreurs structurées `{ error: string, code: string }`

---

## Règles importantes

### Sécurité
- `SUPABASE_SERVICE_ROLE_KEY` → **jamais côté client**, uniquement dans les Server Actions et API Routes
- Ne jamais logger de secrets ou tokens
- RLS (Row Level Security) activé sur toutes les tables Supabase

### Base de données
- Toujours passer par Drizzle ORM pour les queries (pas de SQL raw sauf cas exceptionnel)
- Créer une migration pour chaque changement de schéma : `npm run db:generate`
- Ne jamais modifier directement une migration existante

### Jobs vidéo
- Les jobs de génération vidéo passent **obligatoirement** par Inngest
- Pas d'appels directs Modal depuis le frontend
- Flow : Frontend → Inngest event → Inngest function → Modal → Supabase update → R2 storage

### Cloudflare R2
- Les vidéos générées sont stockées dans R2 sous `alphogenai-assets`
- Utiliser le SDK AWS S3 (`@aws-sdk/client-s3`) avec l'endpoint R2
- Pre-signed URLs pour l'accès en lecture

### Erreurs et monitoring
- Sentry configuré pour les erreurs client et serveur
- Spotlight en dev pour le monitoring local
- Logger avec Pino (pas de `console.log` en production)

---

## Workflow de déploiement

1. Push sur `main` → déploiement automatique Vercel
2. Variables d'environnement configurées dans le dashboard Vercel
3. Migrations DB à appliquer manuellement avant déploiement si changement de schéma

---

## Modèles vidéo

### Long Video Infinity (LVI)
- Focus : génération de vidéos longues
- Inférence via Modal

### Seedance 2.0
- Inférence via Modal

> Toute nouvelle intégration de modèle se fait via un module Python Modal isolé dans `scripts/` ou un repo dédié.
