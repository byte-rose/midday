import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "../types";
import { createBypassClient, isAuthBypassEnabled } from "./bypass";

export { isAuthBypassEnabled, createBypassClient };

export const createClient = () => {
  if (isAuthBypassEnabled()) {
    return createBypassClient();
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // If Supabase is not configured, return bypass client
  if (!supabaseUrl || !supabaseKey) {
    return createBypassClient();
  }

  return createBrowserClient<Database>(
    supabaseUrl,
    supabaseKey,
  );
};
