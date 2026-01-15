# Supabase to OSS Migration Plan

## Current State Analysis

### Supabase Dependencies
```json
{
  "@supabase/supabase-js": "^2.87.0",
  "@supabase/postgrest-js": "^2.87.0",
  "@supabase/ssr": "^0.8.0"
}
```

### Usage Breakdown by Module

#### 1. **Authentication** (High Priority)
**Current Implementation:** Supabase Auth with OAuth providers + MFA

**Files:** ~30+ components using `supabase.auth`

**Features:**
- OAuth (Google, GitHub, Apple)
- Email/OTP authentication
- MFA (TOTP) enrollment/verification
- Session management

**Key Components:**
- `packages/supabase/src/client/middleware.ts` - Session refresh in edge middleware
- `packages/supabase/src/client/server.ts` - Server-side client creation
- `packages/supabase/src/client/client.ts` - Browser client
- `apps/dashboard/src/actions/verify-otp-action.ts`
- `apps/dashboard/src/components/enroll-mfa.tsx`

**Dependencies:**
- `@supabase/auth-js` (part of supabase-js)
- `@supabase/ssr` (for session handling)

**Replacement Options:**
- **NextAuth.js v5** (for Next.js integration + OAuth)
- **Authjs** (lighter, more modular)
- **Ory** (OSS, self-hosted)
- **Kratos** (OSS auth)

---

#### 2. **Database Operations** (Highest Priority)
**Current Implementation:** Postgrest (Supabase REST API wrapper)

**Usage Count:**
- API: 59 queries
- Worker: 47 queries  
- Dashboard: 71 queries
- **Total: 177+ queries across the codebase**

**Query Types:**
- `select()` - read operations
- `insert()` - create
- `update()` - modify
- `delete()` - remove
- `upsert()` - insert or update
- `.rpc()` - stored procedures

**Key Files:**
- `packages/supabase/src/queries/index.ts` - Query builders
- `packages/supabase/src/mutations/index.ts` - Mutations

**Current Pattern:**
```typescript
const result = await supabase
  .from("users")
  .select("*")
  .eq("id", userId)
  .single();
```

**Replacement Options:**
- **Drizzle ORM** (lightweight, TypeScript-first)
- **Prisma** (more abstraction, slower)
- **Kysely** (SQL builder, minimal overhead)
- **Raw `node-postgres`** (most control, no abstraction)

**Database Schema:**
- Already using PostgreSQL (good!)
- Schema migrations exist in `apps/api/migrations/`
- Will need to adapt for new ORM/driver

---

#### 3. **Storage** (Medium Priority)
**Current Implementation:** Supabase Storage (S3-compatible)

**Status:** Already migrated to MinIO ✅
- `packages/supabase/src/storage/minio-client.ts`
- `packages/supabase/src/storage/minio-adapter.ts`

**Usage:** Document vault, file uploads, signed URLs
- `apps/worker/src/processors/transactions/process-attachment.ts`
- `apps/dashboard/src/hooks/use-upload.ts`

**Action:** Remove Supabase storage references, keep MinIO

---

#### 4. **Real-time/Subscriptions** (Lower Priority)
**Current Implementation:** Supabase Realtime (WebSocket)

**Files:**
- `apps/dashboard/src/hooks/use-realtime.ts` - Has Redis fallback already!

**Current Pattern:**
```typescript
const channel = supabase.channel('table:*')
  .on('postgres_changes', { event: '*', schema: 'public' }, ...)
  .subscribe();
```

**Replacement Options:**
- **PostgreSQL LISTEN/NOTIFY** (native, lightweight)
- **Redis Pub/Sub** (already have Redis!)
- **SSE (Server-Sent Events)** (no WebSocket needed)
- **Socket.io** (if real WebSocket needed)

---

#### 5. **Session Management** (Middleware)
**Current Implementation:** `@supabase/ssr` cookie-based sessions

**File:** `packages/supabase/src/client/middleware.ts`

**Used in:** `apps/dashboard/src/middleware.ts`

**What it does:**
- Validates session on each request
- Refreshes expired tokens
- Manages cookies

**Replacement:** Native Next.js middleware with auth library (NextAuth, Authjs, etc.)

---

## Migration Path

### Phase 1: Authentication (Week 1-2)
1. Choose auth library (recommend: **NextAuth.js v5** or **Authjs**)
2. Set up OAuth providers (Google, GitHub, Apple)
3. Migrate session management to chosen library
4. Move MFA logic (TOTP verification)
5. Migrate email/OTP flow
6. Update middleware
7. Test all auth flows

### Phase 2: Database Layer (Week 2-4)
1. Choose ORM/driver (recommend: **Drizzle ORM**)
2. Generate schema from existing Postgres
3. Create ORM models/schemas for all tables
4. Migrate queries incrementally by feature area:
   - User/Team queries
   - Transaction queries
   - Bank connection queries
   - Settings queries
5. Update API routes
6. Update worker tasks
7. Update dashboard actions/components

### Phase 3: Realtime (Week 4-5)
1. Keep current Redis-based fallback
2. Implement PostgreSQL LISTEN/NOTIFY adapter
3. Test with existing realtime subscriptions
4. Remove Supabase realtime references

### Phase 4: Storage (Week 5)
1. Remove Supabase storage client
2. Ensure MinIO usage is complete
3. Cleanup storage wrapper

### Phase 5: Cleanup (Week 5-6)
1. Remove all @supabase dependencies
2. Remove bypass/fallback mode references
3. Update environment variables
4. Remove types/database generated files

---

## Technology Recommendations

### Authentication
```
✅ NextAuth.js v5 (Next.js native, OAuth built-in, MFA support)
OR
✅ Authjs (lighter, modular)
```

### Database
```
✅ Drizzle ORM (lightweight, TypeScript, great DX)
OR
✅ Kysely (pure SQL builder, minimal overhead)
```

### Real-time
```
✅ PostgreSQL LISTEN/NOTIFY (native, no extra infra)
  + Redis Pub/Sub (for multi-instance setup)
```

---

## Files to Modify

### Core
- [x] `packages/supabase/` - Entire package needs replacement
- [ ] `packages/supabase/src/client/server.ts` - Replace with auth library
- [ ] `packages/supabase/src/client/client.ts` - Replace with auth library  
- [ ] `packages/supabase/src/client/middleware.ts` - Replace with auth middleware
- [ ] `packages/supabase/src/queries/` - Replace with ORM
- [ ] `packages/supabase/src/mutations/` - Replace with ORM

### API
- [ ] `apps/api/src/services/supabase.ts` - Auth client initialization
- [ ] `apps/api/src/trpc/init.ts` - Supabase client in context
- [ ] `apps/api/src/trpc/routers/user.ts` - 59+ queries to migrate

### Dashboard
- [ ] `apps/dashboard/src/middleware.ts` - Session handling
- [ ] `apps/dashboard/src/app/api/auth/callback/route.ts` - OAuth callback
- [ ] Auth action files (30+ components)
- [ ] Query/mutation files (71+ queries)

### Worker
- [ ] `apps/worker/src/` - 47+ database queries

### Website
- [ ] `apps/website/src/components/ticker.tsx` - Stats fetching
- [ ] `apps/website/src/lib/fetch-stats.ts` - Stats queries

---

## Environment Variables to Update

### Remove
```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_KEY
NEXT_PUBLIC_AUTH_BYPASS
AUTH_BYPASS_TOKEN
```

### Add
```
# Auth
NEXTAUTH_SECRET
NEXTAUTH_URL
OAUTH_GOOGLE_ID
OAUTH_GOOGLE_SECRET
OAUTH_GITHUB_ID
OAUTH_GITHUB_SECRET
OAUTH_APPLE_ID
OAUTH_APPLE_SECRET

# Database
DATABASE_URL=postgres://...
DATABASE_SSL=true

# Redis (existing)
REDIS_URL=redis://...
```

---

## Data Migration Checklist

- [ ] Export current Postgres schema
- [ ] Verify schema compatibility with chosen ORM
- [ ] Test data migration (if any schema changes)
- [ ] Migrate user authentication data (if using Supabase auth)
- [ ] Update RLS policies → app-level permissions
- [ ] Backup production database

---

## Risk Assessment

| Area | Risk | Mitigation |
|------|------|-----------|
| Auth Migration | Login disruption | Feature flag old/new auth in parallel |
| DB Queries | SQL syntax differences | Extensive testing per query type |
| Real-time Updates | User experience | Keep Redis fallback until stable |
| Session Management | Session loss | Test middleware thoroughly |
| OAuth Providers | Integration breaks | Use same provider credentials |

---

## Success Criteria

- [ ] All auth flows work (OAuth, Email, OTP, MFA)
- [ ] All database queries return same data
- [ ] Real-time updates work without Supabase
- [ ] No Supabase dependencies in package.json
- [ ] All tests pass
- [ ] Deployment successful
