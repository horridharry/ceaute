import assert from "node:assert/strict";
import test from "node:test";
import { getBookingEmailConfiguration } from "../src/lib/emails/booking-email-config.js";

test("missing Resend configuration prevents booking-email claims", () => {
  assert.deepEqual(getBookingEmailConfiguration({}), {
    configured: false,
    diagnostic: "Email delivery is not configured. No pending emails were claimed.",
  });
});

test("complete email configuration permits the existing claim flow", () => {
  assert.deepEqual(
    getBookingEmailConfiguration({
      RESEND_API_KEY: "re_test",
      CEAUTE_EMAIL_FROM: "Ceaute <bookings@example.test>",
      CEAUTE_APP_URL: "https://example.test",
    }),
    {
      configured: true,
      apiKey: "re_test",
      from: "Ceaute <bookings@example.test>",
      appUrl: "https://example.test",
    },
  );
});
