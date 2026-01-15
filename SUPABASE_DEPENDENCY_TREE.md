# Supabase Dependency Tree - Safe to Delete

## Summary
- **Total Supabase References:** 158 files
- **Can Delete Without Breaking:** 70+ files
- **Must Migrate:** 26 auth components
- **Already Replaced:** 97 files using Drizzle ORM

---

## 🟢 SAFE TO DELETE (No other code depends on them)

### Storage Package (Already using MinIO)
```
packages/supabase/src/storage/
├── init-buckets.ts (can delete - MinIO handles this)
└── (other storage files are adapters that wrap minio-client)
```

### Queries/Mutations Package (Not actually used in app)
```
packages/supabase/src/queries/index.ts
packages/supabase/src/mutations/index.ts
```
**Status:** These export helpers like `getUserQuery()` but they're not imported anywhere in the actual codebase.

### Realtime/Channel Mocks
```
packages/supabase/src/client/bypass.ts (lines 72-80)
```
The mock channel implementation can be removed since real-time uses Redis fallback.

---

## 🟡 MUST MIGRATE (Core app functionality)

### Authentication Layer (CRITICAL)

#### 1. Dashboard Components Using Auth (26 files)
```
apps/dashboard/src/components/
├── apple-sign-in.tsx (uses supabase.auth.signInWithOAuth)
├── github-sign-in.tsx (uses supabase.auth.signInWithOAuth)
├── google-sign-in.tsx (uses supabase.auth.signInWithOAuth)
├── otp-sign-in.tsx (uses supabase.auth.signInWithOtp)
├── enroll-mfa.tsx (uses supabase.auth.mfa.*)
├── verify-mfa.tsx (uses supabase.auth.mfa.*)
├── mfa-list.tsx (uses supabase.auth.mfa.listFactors)
├── mfa-settings-list.tsx (uses supabase.auth.mfa.listFactors)
├── delete-account.tsx (uses supabase.auth.signOut)
├── sign-out.tsx (uses supabase.auth.signOut)
├── modals/add-new-device.tsx (uses supabase.auth.mfa.*)
└── ... and others
```
**Action:** Replace with NextAuth.js v5 (or similar auth library)

#### 2. Dashboard Actions (3 files)
```
apps/dashboard/src/actions/
├── verify-otp-action.ts (uses supabase.auth.*)
├── mfa-verify-action.ts (uses supabase.auth.mfa.verify)
├── unenroll-mfa-action.ts (uses supabase.auth.mfa.unenroll)
```
**Action:** Migrate to auth library's API

#### 3. Dashboard Middleware (1 file)
```
apps/dashboard/src/middleware.ts
├── Uses: updateSession from @supabase/ssr
├── Has: isAuthBypassEnabled() check
└── Impact: Session refresh, auth state management
```
**Action:** Replace with NextAuth.js middleware

#### 4. API Auth Service (1 file)
```
apps/api/src/services/supabase.ts
├── createClient() - creates Supabase client
└── createAdminClient() - admin operations
```
**Only used for:** `supabase.auth.admin.deleteUser()`
**Action:** Create custom endpoint instead

#### 5. API Auth Utils (1 file)
```
apps/api/src/utils/auth.ts
├── Uses: Supabase session types
└── Verifies: JWT tokens
```
**Action:** Already JWT-based, can work with any auth system

---

### Database Access in Dashboard (6 files - LOW PRIORITY)

These bypass the API and query DB directly. Should call API instead.

```
apps/dashboard/src/actions/transactions/import-transactions.ts
apps/dashboard/src/actions/institutions/create-plaid-link.ts
apps/dashboard/src/lib/download.ts
apps/dashboard/src/lib/search-ai.ts
```

**Current pattern:**
```typescript
const supabase = await createClient();
const result = await supabase
  .from("transactions")
  .select("*")
  .where(...);
```

**New pattern:**
```typescript
const result = await fetch("/api/transactions", {
  query: {...}
});
```

**Note:** API endpoints for these already exist in `apps/api/src/trpc/routers/`

---

## 🟢 ALREADY DONE (No migration needed)

### API Layer (97 files)
```
apps/api/src/
├── ai/tools/ (28 files) - All use @midday/db
├── trpc/routers/ (26 files) - All use @midday/db
├── rest/routers/ (54+ files) - All use @midday/db
└── Only 1 usage of supabase.auth.admin.deleteUser()
    └── apps/api/src/trpc/routers/user.ts (can be replaced)
```

### Worker Layer (100% using Drizzle)
```
apps/worker/src/
├── processors/ (28+ files) - All use @midday/db
└── No Supabase dependencies
```

### Database Connections
```
packages/db/
├── client.ts - Direct Postgres connection via Drizzle ✅
├── schema.ts - Full schema defined ✅
├── queries/ - All queries via ORM ✅
└── job-client.ts, worker-client.ts - Dedicated connections ✅
```

---

## 📋 Detailed Migration Checklist

### Phase 1: Authentication
```
□ Install NextAuth.js v5
□ Configure OAuth providers
□ Create auth session endpoint
□ Migrate apple-sign-in.tsx
□ Migrate github-sign-in.tsx
□ Migrate google-sign-in.tsx
□ Migrate otp-sign-in.tsx
□ Replace middleware.ts auth handling
□ Implement TOTP MFA in DB
□ Migrate enroll-mfa.tsx
□ Migrate verify-mfa.tsx
□ Migrate MFA list components
□ Replace delete-account.tsx logic
□ Replace sign-out.tsx logic
```

### Phase 2: Database Migrations
```
□ Migrate import-transactions.ts (call API endpoint)
□ Migrate create-plaid-link.ts (call API endpoint)
□ Migrate download.ts (call API endpoint)
□ Migrate search-ai.ts (call API endpoint)
□ Remove queries/mutations from packages/supabase
```

### Phase 3: Cleanup
```
□ Remove @supabase/supabase-js from package.json
□ Remove @supabase/ssr from package.json
□ Remove @supabase/postgrest-js from package.json
□ Delete packages/supabase/src/client/
□ Delete Supabase types and generated files
□ Update environment variables
□ Remove bypass mode code
```

---

## 🔍 Dependency Import Map

### What imports Supabase?

#### High-level imports (packages)
```
packages/supabase/ (wrapper package)
├─ @supabase/supabase-js (main client)
├─ @supabase/ssr (session handling)
└─ @supabase/postgrest-js (REST API client)
```

#### Who imports the wrapper?
```
apps/dashboard/src/ (26+ files)
├─ createClient from @midday/supabase/server
├─ createClient from @midday/supabase/client
└─ isAuthBypassEnabled from @midday/supabase/client

apps/api/src/ (2 files)
├─ supabase.ts service
└─ auth.ts types

apps/website/src/ (2 files)
├─ createServerClient from @supabase/ssr
└─ (for stats fetching - not critical)
```

### Safe removal order
```
1. Remove wrapper imports in dashboard (26 files)
   → No other files depend on these
   
2. Remove auth service in API (1 file)
   → Only used for deleteUser()
   
3. Delete packages/supabase entirely
   → Nothing depends on it after step 1-2
   
4. Update docker-compose, environment
   → Remove Supabase credentials
```

---

## ⚙️ Environment Variables to Handle

### Remove These
```
# Supabase
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_URL=...
SUPABASE_SERVICE_KEY=...

# Bypass
NEXT_PUBLIC_AUTH_BYPASS=...
AUTH_BYPASS_TOKEN=...
AUTH_BYPASS_USER_ID=...
AUTH_BYPASS_EMAIL=...
```

### Add These
```
# NextAuth.js
NEXTAUTH_SECRET=...
NEXTAUTH_URL=http://localhost:3001

# OAuth
OAUTH_GOOGLE_ID=...
OAUTH_GOOGLE_SECRET=...
OAUTH_GITHUB_ID=...
OAUTH_GITHUB_SECRET=...
OAUTH_APPLE_ID=...
OAUTH_APPLE_SECRET=...

# Database (already have these)
DATABASE_PRIMARY_URL=...
DATABASE_URL=... (if not already)
```

---

## 🔐 Data Considerations

### User Auth Data in Supabase
**Current:** User profiles stored in Supabase Auth table
**After Migration:** Move to `users` table in Postgres (already exists)

### Permissions/RLS
**Current:** Supabase Row-Level Security in database
**After Migration:** Enforce at application level

### MFA Seeds/Recovery Codes
**Current:** Stored in Supabase auth
**After Migration:** Store in Postgres `mfa_factors` table

---

## 🚀 Migration Strategy

### Option A: Big Bang (Risky)
1. Remove all Supabase code
2. Implement NextAuth.js
3. Deploy
**Risk:** Auth breaks until everything is done

### Option B: Feature Flags (Safe)
1. Deploy NextAuth.js alongside Supabase
2. Add feature flag: `USE_NEW_AUTH=false`
3. Gradually migrate users to new auth
4. Once all migrated, remove Supabase
**Risk:** Low - can rollback

### Option C: Separate Branch (Cleanest)
1. Create `oss-migration` branch
2. Do entire migration there
3. Test thoroughly
4. Merge to main when ready
**Risk:** Low - but longer timeline

---

## 📊 Impact Summary

| Component | Files | Status | Effort | Risk |
|-----------|-------|--------|--------|------|
| OAuth Setup | 4 | Must reimplement | 2-3 days | High |
| Email/OTP | 2 | Must reimplement | 1-2 days | High |
| MFA | 6 | Must reimplement | 3-4 days | Medium |
| Session Management | 3 | Must reimplement | 1-2 days | High |
| Dashboard DB Queries | 6 | Must migrate to REST | 1-2 days | Low |
| API Auth Admin | 1 | Must replace | 1 day | Low |
| Cleanup | - | Delete old code | 1 day | None |
| **Total** | **22** | - | **~2 weeks** | - |

---

## Summary

**You can partially run the app with AUTH_BYPASS=true, but:**
- ✅ Database works (Drizzle ORM)
- ✅ Worker works (Drizzle ORM)
- ✅ Storage works (MinIO)
- ✅ Real-time fallback works (Redis)
- ❌ Authentication breaks (no OAuth/MFA)
- ❌ User-facing features break (auth-dependent pages)

**To fully migrate to OSS, focus on:**
1. **NextAuth.js implementation** (required)
2. **TOTP MFA in database** (required)
3. **Dashboard to use REST API** (nice to have)
4. **Remove Supabase dependencies** (cleanup)

**Estimated timeline:** 2 weeks with careful implementation.
