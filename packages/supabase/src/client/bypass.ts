type BypassConfig = {
  token?: string;
  userId?: string;
  email?: string;
};

export function isAuthBypassEnabled() {
  return (
    process.env.NEXT_PUBLIC_AUTH_BYPASS === "true" ||
    process.env.AUTH_BYPASS === "true"
  );
}

function useMinioStorage(): boolean {
  // Only check on server, never on client
  if (typeof window !== "undefined") {
    return false;
  }
  return (
    process.env.USE_MINIO === "true" ||
    process.env.MINIO_ENDPOINT !== undefined
  );
}

function getBypassConfig(): Required<BypassConfig> {
  const token =
    process.env.NEXT_PUBLIC_AUTH_BYPASS_TOKEN ||
    process.env.AUTH_BYPASS_TOKEN ||
    "midday-local-dev-token";

  const userId =
    process.env.NEXT_PUBLIC_AUTH_BYPASS_USER_ID ||
    process.env.AUTH_BYPASS_USER_ID ||
    "11111111-1111-1111-1111-111111111111";

  const email =
    process.env.NEXT_PUBLIC_AUTH_BYPASS_EMAIL ||
    process.env.AUTH_BYPASS_EMAIL ||
    "dev@midday.local";

  return { token, userId, email };
}

export function createBypassClient(config?: BypassConfig) {
  const resolved = { ...getBypassConfig(), ...config };

  const session = {
    access_token: resolved.token,
    user: {
      id: resolved.userId,
      email: resolved.email,
      user_metadata: {
        email: resolved.email,
        full_name: "Local Dev",
      },
    },
  };

  const auth = {
    async getSession() {
      return { data: { session }, error: null };
    },
    async signOut() {
      return { error: null };
    },
    mfa: {
      async getAuthenticatorAssuranceLevel() {
        return {
          data: { currentLevel: "aal1", nextLevel: "aal1" },
          error: null,
        };
      },
    },
  };

  const channel = (_name: string) => {
    const ch: any = {
      on() {
        return ch;
      },
      subscribe() {
        return ch;
      },
    };
    return ch;
  };

  // Use MinIO storage adapter if configured, otherwise stub
  // Storage is only available on server-side contexts
  const storage = {
    from() {
      const err = { message: "Storage is disabled in bypass mode" };
      return {
        async upload() {
          return { data: null, error: err };
        },
        async download() {
          return { data: null, error: err };
        },
        async createSignedUrl() {
          return { data: null, error: err };
        },
        async remove() {
          return { data: null, error: err };
        },
        getPublicUrl() {
          return { data: { publicUrl: "" } };
        },
      };
    },
  };

  // Stub database operations - actual queries use the Postgres client
  const from = (_table: string) => {
    return {
      select: () => Promise.resolve({ data: [], error: null }),
      insert: () => Promise.resolve({ data: null, error: null }),
      update: () => Promise.resolve({ data: null, error: null }),
      delete: () => Promise.resolve({ data: null, error: null }),
      upsert: () => Promise.resolve({ data: null, error: null }),
      rpc: () => Promise.resolve({ data: null, error: null }),
    };
  };

  const client: any = {
    auth,
    channel,
    removeChannel() {},
    storage,
    from,
  };

  return client;
}

