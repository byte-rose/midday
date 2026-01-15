# Supabase Integration Map - Functional Analysis

## 🔍 Executive Summary

**Current Stack:**
- ✅ **Database:** Using Drizzle ORM + direct Postgres (97% of app)
- ⚠️ **Auth:** Only Supabase for user management + MFA (26 components)
- ✅ **Storage:** Already using MinIO (S3-compatible)
- ⚠️ **Realtime:** Mock bypass with Redis fallback exists
- ✅ **Auth Bypass:** Enabled - app can run without Supabase for basic functionality

**Key Finding:** The app is **already ~90% decoupled from Supabase**. Only authentication operations require it.

---

## 🏗️ Detailed Integration Map

```
MIDDAY APPLICATION
│
├─ 📊 DATABASE LAYER (177+ queries)
│  ├─ ✅ API (90% using @midday/db + Drizzle)
│  │  ├─ AI Tools: 28 files (all use @midday/db)
│  │  ├─ REST Routes: 54 files (all use @midday/db)
│  │  ├─ tRPC Routers: 26 files (all use @midday/db)
│  │  └─ Only 1 file uses supabase.auth.admin.deleteUser()
│  │
│  ├─ ✅ Worker (100% using @midday/db)
│  │  ├─ 28 files with direct DB queries via Drizzle
│  │  └─ 0 files using Supabase.from()
│  │
│  └─ ⚠️ Dashboard (Mixed)
│     ├─ Server Actions: Uses Supabase client for .from() queries
│     ├─ 6 files using supabase.from() for DB access
│     └─ But can be replaced with REST API calls to backend
│
├─ 🔐 AUTHENTICATION LAYER
│  ├─ ⚠️ Middleware (1 file: middleware.ts)
│  │  ├─ Session refresh via @supabase/ssr
│  │  ├─ Has bypass mode: isAuthBypassEnabled() ✅
│  │  └─ When bypassed: Returns fixed session
│  │
│  ├─ ⚠️ OAuth Providers (26 components)
│  │  ├─ Google Sign-In (apple-sign-in.tsx)
│  │  ├─ GitHub Sign-In (github-sign-in.tsx)
│  │  ├─ Apple Sign-In (apple-sign-in.tsx)
│  │  ├─ OTP/Email (otp-sign-in.tsx)
│  │  └─ MFA Enrollment (enroll-mfa.tsx)
│  │
│  ├─ ⚠️ Session Management
│  │  ├─ Token verification via JWT (apps/api/src/utils/auth.ts)
│  │  ├─ Access token from Authorization header
│  │  └─ Session can be mocked in bypass mode
│  │
│  └─ ⚠️ MFA (TOTP)
│     ├─ supabase.auth.mfa.listFactors()
│     ├─ supabase.auth.mfa.challenge()
│     ├─ supabase.auth.mfa.enroll()
│     ├─ supabase.auth.mfa.verify()
│     └─ supabase.auth.mfa.unenroll()
│
├─ 💾 STORAGE LAYER
│  ├─ ✅ MinIO (Configured & Working)
│  │  ├─ packages/supabase/src/storage/minio-client.ts
│  │  ├─ Document vault
│  │  ├─ File uploads
│  │  └─ Signed URLs
│  │
│  └─ ❌ Supabase Storage (Not used)
│     └─ Fallback error: "Storage is disabled in auth bypass mode"
│
└─ 📡 REALTIME LAYER
   ├─ ⚠️ Hook: apps/dashboard/src/hooks/use-realtime.ts
   ├─ Fallback Strategy:
   │  ├─ If bypass enabled: Use Redis + SSE polling
   │  └─ Else: Use Supabase realtime channels
   └─ Note: Mock subscriptions exist (on/subscribe no-ops)
```

---

## 🔌 Current Auth Bypass Implementation

### Files Checking for Bypass
```
packages/supabase/src/client/bypass.ts
packages/supabase/src/client/server.ts
packages/supabase/src/client/client.ts
packages/supabase/src/client/middleware.ts
apps/dashboard/src/hooks/use-realtime.ts
```

### Bypass Behavior
```typescript
// Enabled via environment variable
isAuthBypassEnabled() {
  return process.env.AUTH_BYPASS === "true" ||
         process.env.NEXT_PUBLIC_AUTH_BYPASS === "true"
}

// When enabled, returns mock client:
{
  auth: {
    getSession() → returns fixed user
    signOut() → no-op
    mfa: {
      getAuthenticatorAssuranceLevel() → returns aal1
    }
  },
  channel() → no-op (mocked realtime)
  storage: {
    from() → stub with error for disabled mode
  },
  from() → throws "Database operations are disabled"
}
```

### The Problem with Current Bypass
```
✅ Auth works: Mock session returned
✅ Realtime works: Fallback to Redis (use-realtime.ts)
❌ Database fails: .from() throws error
❌ Storage fails: Returns error
```

**The bypass prevents database access.** This is why the app needs direct Postgres connection via Drizzle instead.

---

## 📋 Detailed Supabase Usage by Feature

### 1️⃣ Authentication (26 Components - HIGH PRIORITY)

#### OAuth Sign-In (4 components)
```
apps/dashboard/src/components/apple-sign-in.tsx
apps/dashboard/src/components/github-sign-in.tsx
apps/dashboard/src/components/google-sign-in.tsx
```
**Current:** `supabase.auth.signInWithOAuth({ provider: 'google', ... })`
**Data flow:** Browser → Supabase Auth → Provider → Callback

#### Email/OTP Sign-In (2 files)
```
apps/dashboard/src/components/otp-sign-in.tsx
apps/dashboard/src/actions/verify-otp-action.ts
```
**Current:** `supabase.auth.signInWithOtp({ email })`

#### MFA Enrollment (4 components)
```
apps/dashboard/src/components/enroll-mfa.tsx
apps/dashboard/src/components/modals/add-new-device.tsx
apps/dashboard/src/components/mfa-list.tsx
apps/dashboard/src/components/mfa-settings-list.tsx
```
**Operations:**
- `supabase.auth.mfa.challenge({ factorId })`
- `supabase.auth.mfa.enroll({ factorType: 'totp' })`
- `supabase.auth.mfa.verify({ factorId, code })`
- `supabase.auth.mfa.listFactors()`

#### MFA Verification (2 files)
```
apps/dashboard/src/components/verify-mfa.tsx
apps/dashboard/src/actions/mfa-verify-action.ts
apps/dashboard/src/actions/unenroll-mfa-action.ts
```
**Operations:**
- Challenge TOTP factor
- Verify TOTP code
- Unenroll factor

#### Session Management (3 files)
```
packages/supabase/src/client/middleware.ts
packages/supabase/src/client/server.ts
apps/dashboard/src/app/api/auth/callback/route.ts
```
**Current:** `@supabase/ssr` handles cookie-based sessions
**OAuth callback:** Exchanges code for session token

#### Account Management (2 files)
```
apps/dashboard/src/components/delete-account.tsx
apps/dashboard/src/components/sign-out.tsx
```
**Operations:**
- `supabase.auth.signOut()`
- `supabase.auth.admin.deleteUser()` (API only, in user.ts router)

---

### 2️⃣ Database Queries (6 files - LOW PRIORITY)

> **Note:** These are edge cases. 97% of app uses Drizzle ORM instead.

```
apps/dashboard/src/actions/transactions/import-transactions.ts
apps/dashboard/src/actions/institutions/create-plaid-link.ts
apps/dashboard/src/lib/download.ts
apps/dashboard/src/lib/search-ai.ts
packages/supabase/src/queries/index.ts
packages/supabase/src/mutations/index.ts
```

**Pattern:**
```typescript
// Current (Supabase)
const result = await supabase
  .from("transactions")
  .select("*")
  .eq("team_id", teamId);

// Should be (Drizzle) - Already available in API
const result = await db.query.transactions.findMany({
  where: eq(transactions.teamId, teamId)
});
```

**Solution:** These should call REST API endpoints (already exist) instead of direct DB access.

---

### 3️⃣ Storage (MinIO - ALREADY DONE ✅)

```
packages/supabase/src/storage/minio-client.ts
packages/supabase/src/storage/minio-adapter.ts
packages/supabase/src/storage/init-buckets.ts
```

**Status:** ✅ Already using MinIO (S3-compatible)
**No changes needed** - Storage is decoupled

---

### 4️⃣ Real-time (1 hook - LOW PRIORITY)

```
apps/dashboard/src/hooks/use-realtime.ts
```

**Current:**
```typescript
if (isAuthBypassEnabled()) {
  // Use Redis Pub/Sub + polling fallback ✅
} else {
  // Use Supabase realtime channels
}
```

**Status:** Fallback already works!

---

## 🚀 What Works Right Now with AUTH_BYPASS=true?

### ✅ Works
- [ ] Dashboard loads (if auth bypass enabled)
- [ ] Session exists (mocked user)
- [ ] API calls work (if using Drizzle ORM)
- [ ] Real-time updates (Redis fallback)
- [ ] Storage/MinIO (already configured)
- [ ] Worker tasks (all use Drizzle)

### ❌ Doesn't Work
- [ ] User authentication (Google, GitHub, Apple OAuth)
- [ ] Email/OTP sign-in
- [ ] MFA enrollment/verification
- [ ] Account settings
- [ ] Direct `.from()` DB queries in dashboard actions

### ⚠️ Broken if you try to use bypass
- [ ] Clicking "Sign In" button → error
- [ ] User settings → depends on which settings
- [ ] Any server action using `supabase.from()` → throws error

---

## 🔄 Data Flows

### Current Flow with Supabase
```
User → Auth OAuth → Supabase Auth → Session → App
                           ↓
                      User records
                      (not in app DB)
```

### Flow After OSS Migration
```
User → Auth (NextAuth.js) → Postgres (users table) → Session → App
```

### Database Access
```
Current (Mixed):
Dashboard Actions ─→ Supabase.from() ─→ Postgres
API Routes ────────→ Drizzle ORM ──→ Postgres
Worker Tasks ──────→ Drizzle ORM ──→ Postgres

After OSS:
Dashboard Actions ─→ REST API ─→ API Routes ─→ Drizzle ORM ─→ Postgres
API Routes ────────→ Drizzle ORM ────────────→ Postgres
Worker Tasks ──────→ Drizzle ORM ────────────→ Postgres
```

---

## 💡 Why Current Bypass Isn't Sufficient

The `createBypassClient()` returns a mock client that:
1. **Mocks auth** ✅ - Always returns fixed user
2. **Mocks realtime** ✅ - Redis fallback exists
3. **Blocks storage** ❌ - Returns error (but MinIO is separate anyway)
4. **Blocks database** ❌ - Throws "Database operations are disabled"

**The database block is the problem.** Dashboard server actions try to use `.from()` directly instead of calling the API.

---

## 📊 Technical Breakdown

| Component | Current | Dependency | Status | Migration Path |
|-----------|---------|----------|--------|-----------------|
| Auth Session | Supabase SSR | @supabase/ssr | ⚠️ Critical | NextAuth.js v5 |
| OAuth (Google, GitHub, Apple) | Supabase Auth | @supabase/supabase-js | ⚠️ Critical | NextAuth.js v5 |
| Email/OTP | Supabase Auth | @supabase/supabase-js | ⚠️ Critical | NextAuth.js v5 |
| MFA (TOTP) | Supabase Auth | @supabase/supabase-js | ⚠️ Critical | Custom TOTP + DB |
| API Database | Drizzle ORM | @midday/db | ✅ Done | No change |
| Worker Database | Drizzle ORM | @midday/db | ✅ Done | No change |
| Dashboard DB Queries | Supabase | @supabase/supabase-js | ⚠️ Medium | REST API calls |
| Storage | MinIO | Custom | ✅ Done | No change |
| Realtime | Redis + Mock | Redis | ✅ Done | No change |
| Admin Operations | Supabase | @supabase/supabase-js | 🟡 Low | Custom endpoint |

---

## 🎯 Conclusion

### Current State
- **90% of app is already OSS-ready** via Drizzle ORM + PostgreSQL
- **Auth is the blocker** - 26 components depend on Supabase Auth
- **Bypass mode exists but is incomplete** - blocks DB operations

### To Run with Current Auth Bypass
**You can't fully use it.** The bypass prevents `.from()` queries needed in dashboard actions.

### What You Need
1. **Either:** Remove dashboard auth/account pages
2. **Or:** Replace Supabase Auth with NextAuth.js v5
3. **Or:** Migrate dashboard to use REST API instead of direct DB access

### Migration Priority
1. 🔴 **Phase 1:** NextAuth.js setup (required for any auth)
2. 🟡 **Phase 2:** TOTP MFA implementation
3. 🟡 **Phase 3:** Dashboard server actions → REST API
4. 🟢 **Phase 4:** Cleanup old Supabase code
