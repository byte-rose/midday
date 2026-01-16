import { type JWTPayload, jwtVerify } from "jose";

export type Session = {
  user: {
    id: string;
    email?: string;
    full_name?: string;
  };
  teamId?: string;
};

type SupabaseJWTPayload = JWTPayload & {
  user_metadata?: {
    email?: string;
    full_name?: string;
    [key: string]: string | undefined;
  };
};

export async function verifyAccessToken(
  accessToken?: string,
): Promise<Session | null> {
  if (!accessToken) return null;

  const isAuthBypassEnabled =
    process.env.AUTH_BYPASS === "true" ||
    process.env.MIDDAY_AUTH_BYPASS === "true";

  if (isAuthBypassEnabled) {
    const bypassToken =
      process.env.AUTH_BYPASS_TOKEN ||
      process.env.MIDDAY_AUTH_BYPASS_TOKEN ||
      "midday-local-dev-token";

    if (accessToken === bypassToken) {
      return {
        user: {
          id:
            process.env.AUTH_BYPASS_USER_ID ??
            process.env.MIDDAY_AUTH_BYPASS_USER_ID ??
            "11111111-1111-1111-1111-111111111111",
          email:
            process.env.AUTH_BYPASS_EMAIL ??
            process.env.MIDDAY_AUTH_BYPASS_EMAIL ??
            "dev@midday.local",
          full_name:
            process.env.AUTH_BYPASS_FULL_NAME ??
            process.env.MIDDAY_AUTH_BYPASS_FULL_NAME ??
            "Local Dev",
        },
      };
    }
  }

  try {
    const { payload } = await jwtVerify(
      accessToken,
      new TextEncoder().encode(process.env.SUPABASE_JWT_SECRET),
    );

    const supabasePayload = payload as SupabaseJWTPayload;

    return {
      user: {
        id: supabasePayload.sub!,
        email: supabasePayload.user_metadata?.email,
        full_name: supabasePayload.user_metadata?.full_name,
      },
    };
  } catch (error) {
    return null;
  }
}
