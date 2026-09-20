import { resolveApplicationOrigin } from "@/lib/app/origin";

export function getBookingEmailConfiguration(environment) {
  const apiKey = environment.RESEND_API_KEY;
  const from = environment.CEAUTE_EMAIL_FROM;
  // Every environment uses its configured canonical CEAUTE_APP_URL. Preview
  // falls back to its generated deployment URL only when that is absent.
  const appUrl = resolveApplicationOrigin(environment);

  if (!apiKey || !from || !appUrl) {
    return {
      configured: false,
      diagnostic: "Email delivery is not configured. No pending emails were claimed.",
    };
  }

  return { configured: true, apiKey, from, appUrl };
}
