import assert from "node:assert/strict";
import test from "node:test";
import { resolveRequestOrigin } from "../src/lib/app/origin.js";
import { buildRecipientOnboardingAccountLink } from "../src/lib/stripe/account-link.js";

const headersFrom = (entries) => ({
  get: (name) => entries[name] ?? null,
});

// The Preview runtime as Vercel actually presents it: the canonical domain is
// configured, a generated deployment hostname is present alongside it, and the
// request headers are treated as hostile.
const previewEnvironment = {
  CEAUTE_APP_URL: "https://preview.ceaute.com",
  VERCEL_ENV: "preview",
  VERCEL_URL: "ceaute-git-preview-abc123.vercel.app",
};

const hostileHeaders = headersFrom({
  origin: "https://localhost:3000",
  host: "localhost:3000",
  "x-forwarded-proto": "https",
});

// Walks the payload Stripe is actually handed, so a callback URL cannot hide
// behind a nested key the assertions below did not think to name.
function collectStrings(value, path = "use_case", found = []) {
  if (typeof value === "string") {
    found.push([path, value]);
  } else if (Array.isArray(value)) {
    value.forEach((entry, index) => collectStrings(entry, `${path}[${index}]`, found));
  } else if (value && typeof value === "object") {
    for (const [key, entry] of Object.entries(value)) {
      collectStrings(entry, `${path}.${key}`, found);
    }
  }

  return found;
}

function buildPreviewAccountLinkParams(environment = previewEnvironment) {
  return buildRecipientOnboardingAccountLink({
    accountId: "acct_test_preview",
    origin: resolveRequestOrigin(hostileHeaders, environment),
  });
}

test("Preview Connect sends its canonical return and refresh URLs to Stripe", () => {
  const params = buildPreviewAccountLinkParams();

  assert.equal(params.account, "acct_test_preview");
  assert.equal(params.use_case.type, "account_onboarding");
  assert.deepEqual(params.use_case.account_onboarding, {
    configurations: ["recipient"],
    refresh_url: "https://preview.ceaute.com/dashboard/settings/payments",
    return_url:
      "https://preview.ceaute.com/dashboard/settings/payments?returned=1",
  });
});

// The regression this file exists for. Stripe rejected a real Preview Account
// Link with `invalid_fields` naming `use_case: return_url`, so the guarantee
// worth pinning is about the whole payload, not one field.
test("no value in the Preview Account Link payload can reach Stripe as localhost", () => {
  const params = buildPreviewAccountLinkParams();

  for (const [path, value] of collectStrings(params)) {
    assert.doesNotMatch(
      value,
      /localhost|127\.0\.0\.1|\[::1\]/,
      `${path} leaked a local host to Stripe: ${value}`,
    );
    assert.doesNotMatch(
      value,
      /vercel\.app/,
      `${path} leaked a generated deployment hostname to Stripe: ${value}`,
    );
  }
});

test("every callback URL Stripe is sent is an absolute https URL", () => {
  const { account_onboarding: onboarding } = buildPreviewAccountLinkParams().use_case;

  for (const key of ["refresh_url", "return_url"]) {
    const value = onboarding[key];

    assert.ok(value.startsWith("https://"), `${key} must start with https://`);
    assert.equal(new URL(value).origin, "https://preview.ceaute.com");
  }
});

// A canonical URL pasted into a dashboard with its quotes still attached reads
// back as correct but produces a callback Stripe rejects outright.
test("a quoted CEAUTE_APP_URL still yields clean https callback URLs", () => {
  const { account_onboarding: onboarding } = buildPreviewAccountLinkParams({
    ...previewEnvironment,
    CEAUTE_APP_URL: '"https://preview.ceaute.com"',
  }).use_case;

  assert.equal(
    onboarding.return_url,
    "https://preview.ceaute.com/dashboard/settings/payments?returned=1",
  );
  assert.equal(
    onboarding.refresh_url,
    "https://preview.ceaute.com/dashboard/settings/payments",
  );
});

test("a CEAUTE_APP_URL without a scheme fails before Stripe is called", () => {
  assert.throws(
    () =>
      buildPreviewAccountLinkParams({
        ...previewEnvironment,
        CEAUTE_APP_URL: "preview.ceaute.com",
      }),
    /CEAUTE_APP_URL must be an absolute http\(s\) URL/,
  );
});
