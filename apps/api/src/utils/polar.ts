import { Polar } from "@polar-sh/sdk";

function createNoopPolar() {
  return new Proxy(
    {},
    {
      get() {
        throw new Error(
          "Polar is not configured (set POLAR_ACCESS_TOKEN to enable billing)",
        );
      },
    },
  );
}

export const polarEnabled = Boolean(process.env.POLAR_ACCESS_TOKEN);
export const api: Polar = polarEnabled
  ? new Polar({
      accessToken: process.env.POLAR_ACCESS_TOKEN!,
      server: process.env.POLAR_ENVIRONMENT as "production" | "sandbox",
    })
  : (createNoopPolar() as unknown as Polar);
