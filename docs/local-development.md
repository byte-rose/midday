# Local Development (No Hosted Supabase/Vercel)

This repo can be run locally with just Docker (Postgres 18 + Redis) and a simple auth bypass mode.

## Prerequisites

- Docker + Docker Compose v2 (`docker compose`)
- Bun (`bun@1.2.22`, see `package.json`)

## 1) Start Postgres + Redis

From the repo root:

```bash
docker compose up -d db redis
```

If you’re on Fedora/RHEL with SELinux enforcing and you see permission errors for `/docker-entrypoint-initdb.d`, this repo’s `docker-compose.yml` already uses `:z` bind-mount labels.

This starts:

- Postgres (`pgvector/pgvector:pg18`) on `localhost:5432`
- Redis on `localhost:6379`

The DB is initialized from `apps/api/migrations/0000_bumpy_chat.sql` plus a small dev seed.

## 2) Run API + Dashboard (Docker)

This will build and start the app containers (`api`, `dashboard`) in addition to `db` and `redis`:

```bash
docker compose up -d --build
```

If the build is very slow (first-time installs on small VMs can take a while), this repo’s `docker/Dockerfile.dev` is set up to install only the required workspace per container and to cache Bun downloads via BuildKit.

If you hit Bun tarball integrity errors during `bun install`, try:

```bash
docker compose build --no-cache
```

If installs are extremely slow on a small VM, build one service at a time (to avoid 3 parallel `bun install`s fighting over CPU/network) and reuse the shared Bun cache:

```bash
docker compose build api
docker compose build dashboard
docker compose build worker
```

Open:

- `http://localhost:3001` (dashboard)
- `http://localhost:3003/health` (api)
- `http://localhost:8080/admin/queues` (worker BullBoard UI; optional basic auth via `BOARD_USERNAME`/`BOARD_PASSWORD`)

Worker notes: `docs/workers.md`.

Issue tracking: `docs/issues/0001-selfhost-minimal-local-stack.md`.

## 3) Configure env (Host / non-Docker)

API:

```bash
cp apps/api/.env-template apps/api/.env
```

Dashboard:

```bash
cp apps/dashboard/.env-example apps/dashboard/.env.local
```

Defaults are set up so the dashboard uses auth bypass and the API accepts the same bearer token.

## 4) Run the apps (Host / non-Docker)

Install deps once:

```bash
bun i
```

Run API + dashboard (and anything else configured in Turbo):

```bash
bun dev:local
```

Or individually:

```bash
bun dev:api
bun dev:dashboard
```

## Notes / limitations

- Auth bypass is controlled by `NEXT_PUBLIC_AUTH_BYPASS` (dashboard) and `MIDDAY_AUTH_BYPASS` (api).
- Supabase Auth/Storage/Realtime are not running in this mode; features that rely on Supabase storage will return errors.
- Email sending is disabled unless `RESEND_API_KEY` is set (the API will log and skip emails otherwise).
- Billing endpoints are disabled unless `POLAR_ACCESS_TOKEN` is set.
- AI features:
  - Transaction enrichment requires `GOOGLE_GENERATIVE_AI_API_KEY` (jobs are skipped otherwise).
  - Embeddings fall back to a local deterministic generator unless `GOOGLE_GENERATIVE_AI_API_KEY` is set.
- If you change Postgres major versions (or hit Postgres 18+ data-dir warnings), wipe volumes: `docker compose down -v`.
