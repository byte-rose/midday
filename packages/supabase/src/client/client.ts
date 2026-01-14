import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "../types";
import { createBypassClient, isAuthBypassEnabled } from "./bypass";

export { isAuthBypassEnabled };

export const createClient = () => {
  if (isAuthBypassEnabled()) {
    return createBypassClient();
  }

  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
};
