export function getBookingEmailConfiguration(environment) {
  const apiKey = environment.RESEND_API_KEY;
  const from = environment.CEAUTE_EMAIL_FROM;
  const appUrl = environment.CEAUTE_APP_URL;

  if (!apiKey || !from || !appUrl) {
    return {
      configured: false,
      diagnostic: "Email delivery is not configured. No pending emails were claimed.",
    };
  }

  return { configured: true, apiKey, from, appUrl };
}
