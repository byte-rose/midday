import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "../types";
import { createBypassClient, isAuthBypassEnabled } from "./bypass";

const conWarn = console.warn;
const conLog = console.log;

const IGNORE_WARNINGS = [
  "Using the user object as returned from supabase.auth.getSession()",
];

console.warn = (...args) => {
  const match = args.find((arg) =>
    typeof arg === "string"
      ? IGNORE_WARNINGS.find((warning) => arg.includes(warning))
      : false,
  );
  if (!match) {
    conWarn(...args);
  }
};

console.log = (...args) => {
  const match = args.find((arg) =>
    typeof arg === "string"
      ? IGNORE_WARNINGS.find((warning) => arg.includes(warning))
      : false,
  );
  if (!match) {
    conLog(...args);
  }
};

type CreateClientOptions = {
  admin?: boolean;
  schema?: "public" | "storage";
};

export async function createClient(options?: CreateClientOptions) {
  if (isAuthBypassEnabled()) {
    return createBypassClient();
  }

  const { admin = false, ...rest } = options ?? {};
  const cookieStore = await cookies();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = admin
    ? process.env.SUPABASE_SERVICE_KEY
    : process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // If Supabase is not configured, return bypass client
  if (!supabaseUrl || !supabaseKey) {
    return createBypassClient();
  }

  const auth = admin
    ? {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      }
    : {};

  return createServerClient<Database>(
    supabaseUrl,
    supabaseKey,
    {
      ...rest,
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
      auth,
    },
  );
}
