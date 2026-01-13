import { Resend } from "resend";

type ResendEmailSendArgs = Parameters<Resend["emails"]["send"]>[0];
type ResendContactRemoveArgs = Parameters<Resend["contacts"]["remove"]>[0];

function createNoopResend() {
  return {
    emails: {
      send: async (args: ResendEmailSendArgs) => {
        console.warn(
          "[Email] RESEND_API_KEY is not set; skipping email send",
          args ? { to: (args as any).to, subject: (args as any).subject } : {},
        );
        return { data: null, error: null } as any;
      },
    },
    contacts: {
      remove: async (args: ResendContactRemoveArgs) => {
        console.warn(
          "[Email] RESEND_API_KEY is not set; skipping contact removal",
          args ? { email: (args as any).email } : {},
        );
        return { data: null, error: null } as any;
      },
    },
  } as const;
}

export const resendEnabled = Boolean(process.env.RESEND_API_KEY);
export const resend: Resend = resendEnabled
  ? new Resend(process.env.RESEND_API_KEY!)
  : (createNoopResend() as unknown as Resend);
