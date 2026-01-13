# Issue: Self-host minimal local stack (no Supabase/Vercel)

## Goal

Run Midday locally on a VM with minimal third-party dependencies:

- Postgres 18 (+ required extensions)
- Redis
- API + Dashboard + Worker via `docker compose`
- Auth bypass mode (no Supabase Auth required)

## Current status

**Working:**

- Postgres initializes successfully with required helper functions/extensions.
- Redis runs for cache + BullMQ.
- `docker compose` includes `db`, `redis`, `api`, `dashboard`, `worker`.
- Dashboard auth bypass works (session stub) and API accepts bearer token bypass.
- Worker runs BullMQ processors and exposes BullBoard UI.

**Known limitations (by design for “minimal”):**

- Supabase Storage/Realtime/Auth are not self-hosted; flows requiring `supabase.storage.*` will fail until we add MinIO (next phase).
- Some scheduled worker jobs are gated by `WORKER_ENV=production` and will no-op in dev.
- Email is disabled unless `RESEND_API_KEY` is set.
- Billing is disabled unless `POLAR_ACCESS_TOKEN` is set.
- AI is optional:
  - Transaction enrichment is skipped unless `GOOGLE_GENERATIVE_AI_API_KEY` is set.
  - Embeddings fall back to a local deterministic generator unless `GOOGLE_GENERATIVE_AI_API_KEY` is set.

## What we changed

- `docker-compose.yml`:
  - Added `db` (pg18 + pgvector), `redis`, `api`, `dashboard`, `worker`
  - Fixed Postgres 18+ volume mount path
  - Added SELinux `:z` labels for bind mounts
- DB bootstrap:
  - `docker/postgres/init/00_bootstrap.sql` adds `pgcrypto`, `vector`, `pg_trgm` + helper functions used by schema
  - `docker/postgres/init/10_load_midday_schema.sh` loads the schema and strips broken BTREE opclasses from introspected SQL
  - `docker/postgres/init/20_seed_dev.sql` seeds a deterministic dev user/team
- Auth bypass:
  - `apps/api/src/utils/auth.ts` accepts `MIDDAY_AUTH_BYPASS_TOKEN`
  - `packages/supabase/src/client/bypass.ts` stubs supabase client auth/session for dashboard
- Docker app env:
  - `apps/api/.env.docker`, `apps/dashboard/.env.docker`, `apps/worker/.env.docker`
- Worker controls:
  - `WORKER_ENABLED_QUEUES` to restrict which queues are processed
  - `WORKER_CONCURRENCY_*` to tune per-queue concurrency (dev defaults reduced)

## How to run

From repo root:

```bash
docker compose up -d --build
```

Open:

- Dashboard: `http://localhost:3001`
- API health: `http://localhost:3003/health`
- BullBoard: `http://localhost:8080/admin/queues`

## Next steps (follow-up issues)

- Add MinIO and an internal storage adapter to replace Supabase Storage usage
- Optional: replace Supabase Realtime usage in dashboard (or disable realtime features locally)
- Optional: replace remaining Supabase Admin APIs used by API routes
