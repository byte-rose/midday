# Workers (Local)

Midday uses a BullMQ-based worker service (`apps/worker`) for background processing.

## What it runs

The worker process:

- Connects to Redis (`REDIS_QUEUE_URL`) for BullMQ queues
- Connects to Postgres (`DATABASE_PRIMARY_POOLER_URL`) for reads/writes
- Exposes BullBoard at `http://localhost:8080/admin/queues`

### Queues

The worker starts workers for these queues (see `apps/worker/src/queues/index.ts`):

- `inbox`
- `inbox-provider`
- `transactions`
- `documents`
- `embeddings`
- `rates`
- `accounting`

## Scheduling behavior

The worker registers BullMQ job schedulers on startup, but most scheduled processors are gated behind:

- `WORKER_ENV=production`

In local/dev (`WORKER_ENV=development`), the scheduled tasks will enqueue but the processors typically short-circuit and log “Skipping … in non-production environment”.

## Options

### Option A (current): Run workers with “auth bypass” (no Supabase)

This is the simplest mode and works for DB+queue flows.

Limitations:

- Jobs and API routes that rely on Supabase Storage (download/upload/signed URLs) will fail until storage is replaced or self-hosted.

Tuning:

- Limit queues processed: set `WORKER_ENABLED_QUEUES` (e.g. `transactions,inbox`).
- Override concurrency per queue: `WORKER_CONCURRENCY_<QUEUE>` (e.g. `WORKER_CONCURRENCY_INBOX=10`).

### Option B: Self-host a storage backend (recommended next step)

To get document/inbox processing working locally you need storage.

Common approaches:

- Add `minio` (S3-compatible) and replace `@midday/supabase/storage` + `supabase.storage.*` usage with an S3 adapter.
- Self-host Supabase Storage + Auth + Realtime (larger stack, closer to upstream).

### Option C: Keep workers but disable specific features

If you only want “core dashboard + DB” locally:

- Run worker for queue visibility and basic job execution.
- Avoid flows that upload/download files until storage is added.

## Compose

Bring up everything (db, redis, api, dashboard, worker):

```bash
docker compose up -d --build
```

Worker UI:

- `http://localhost:8080/admin/queues`
