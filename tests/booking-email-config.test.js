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

test("a Preview deployment sends links to its own deployment URL", () => {
  assert.deepEqual(
    getBookingEmailConfiguration({
      RESEND_API_KEY: "re_test",
      CEAUTE_EMAIL_FROM: "Ceaute <bookings@example.test>",
      CEAUTE_APP_URL: "https://ceaute.com",
      VERCEL_ENV: "preview",
      VERCEL_URL: "ceaute-git-feature-branch.vercel.app",
    }),
    {
      configured: true,
      apiKey: "re_test",
      from: "Ceaute <bookings@example.test>",
      appUrl: "https://ceaute-git-feature-branch.vercel.app",
    },
  );
});

test("Production keeps the canonical origin even when VERCEL_URL is present", () => {
  assert.deepEqual(
    getBookingEmailConfiguration({
      RESEND_API_KEY: "re_test",
      CEAUTE_EMAIL_FROM: "Ceaute <bookings@example.test>",
      CEAUTE_APP_URL: "https://ceaute.com",
      VERCEL_ENV: "production",
      VERCEL_URL: "ceaute-abc123.vercel.app",
    }),
    {
      configured: true,
      apiKey: "re_test",
      from: "Ceaute <bookings@example.test>",
      appUrl: "https://ceaute.com",
    },
  );
});

test("an unresolvable application origin leaves email delivery unconfigured", () => {
  assert.deepEqual(
    getBookingEmailConfiguration({
      RESEND_API_KEY: "re_test",
      CEAUTE_EMAIL_FROM: "Ceaute <bookings@example.test>",
    }),
    {
      configured: false,
      diagnostic: "Email delivery is not configured. No pending emails were claimed.",
    },
  );
});
