import { resolveApplicationOrigin } from "@/lib/app/origin";

export function getBookingEmailConfiguration(environment) {
  const apiKey = environment.RESEND_API_KEY;
  const from = environment.CEAUTE_EMAIL_FROM;
  // Preview deployments resolve to their own deployment URL so a test email
  // links back to the deployment under test; Production and local development
  // use the configured CEAUTE_APP_URL.
  const appUrl = resolveApplicationOrigin(environment);

  if (!apiKey || !from || !appUrl) {
    return {
      configured: false,
      diagnostic: "Email delivery is not configured. No pending emails were claimed.",
    };
  }

  return { configured: true, apiKey, from, appUrl };
}
