import assert from "node:assert/strict";
import test from "node:test";
import { resolveRequestOrigin } from "../src/lib/app/origin.js";
import { buildRecipientOnboardingAccountLink } from "../src/lib/stripe/account-link.js";

const headersFrom = (entries) => ({
  get: (name) => entries[name] ?? null,
});

test("Preview Connect sends its canonical return and refresh URLs to Stripe", () => {
  const origin = resolveRequestOrigin(
    headersFrom({
      origin: "https://localhost:3000",
      host: "localhost:3000",
      "x-forwarded-proto": "https",
    }),
    {
      CEAUTE_APP_URL: "https://preview.ceaute.com",
      VERCEL_ENV: "preview",
      VERCEL_URL: "ceaute-generated.vercel.app",
    },
  );

  const params = buildRecipientOnboardingAccountLink({
    accountId: "acct_test_preview",
    origin,
  });

  assert.equal(params.account, "acct_test_preview");
  assert.deepEqual(params.use_case.account_onboarding, {
    configurations: ["recipient"],
    refresh_url: "https://preview.ceaute.com/dashboard/settings/payments",
    return_url:
      "https://preview.ceaute.com/dashboard/settings/payments?returned=1",
  });
});
