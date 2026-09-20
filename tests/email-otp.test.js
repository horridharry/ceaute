import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  PENDING_AUTH_MAX_AGE_SECONDS,
  RESEND_COOLDOWN_SECONDS,
  classifyOtpRequestError,
  classifyOtpVerifyError,
  normalizeEmail,
  normalizeOtpCode,
  otpRequestMessage,
  otpVerifyMessage,
  parsePendingAuth,
  requestEmailCode,
  resendWaitSeconds,
  serializePendingAuth,
  verifyEmailCode,
} from "../src/lib/auth/email-otp.js";
import { validatedNextPath } from "../src/lib/auth/redirect.js";

// Shaped like @supabase/auth-js AuthApiError.
function authError(status, code, message = "Auth error") {
  return { name: "AuthApiError", status, code, message };
}

function fakeSupabase({ requestError = null, verifyResult = null } = {}) {
  const calls = [];

  return {
    calls,
    auth: {
      async signInWithOtp(parameters) {
        calls.push({ method: "signInWithOtp", parameters });
        return { data: {}, error: requestError };
      },
      async verifyOtp(parameters) {
        calls.push({ method: "verifyOtp", parameters });
        return (
          verifyResult ?? {
            data: { session: { access_token: "session" }, user: { id: "user-1" } },
            error: null,
          }
        );
      },
    },
  };
}

test("sign-up asks Supabase for a code, may create the account and sends no link target", async () => {
  const supabase = fakeSupabase();

  const result = await requestEmailCode({
    supabase,
    email: "new@example.com",
    flow: "sign-up",
    fullName: "Ada Lovelace",
  });

  assert.deepEqual(result, { ok: true });
  assert.deepEqual(supabase.calls, [
    {
      method: "signInWithOtp",
      parameters: {
        email: "new@example.com",
        options: { data: { full_name: "Ada Lovelace" }, shouldCreateUser: true },
      },
    },
  ]);
});

test("a new account is verified with the email OTP type and yields the signed-in user", async () => {
  const supabase = fakeSupabase();

  const result = await verifyEmailCode({
    supabase,
    email: "new@example.com",
    code: "123 456",
  });

  assert.deepEqual(result, { ok: true, userId: "user-1" });
  assert.deepEqual(supabase.calls, [
    {
      method: "verifyOtp",
      parameters: { email: "new@example.com", token: "123456", type: "email" },
    },
  ]);
});

test("returning-user sign-in never creates an account and verifies the same way", async () => {
  const supabase = fakeSupabase();

  assert.deepEqual(
    await requestEmailCode({ supabase, email: "back@example.com", flow: "sign-in" }),
    { ok: true },
  );
  assert.deepEqual(
    await verifyEmailCode({ supabase, email: "back@example.com", code: "654321" }),
    { ok: true, userId: "user-1" },
  );
  assert.deepEqual(supabase.calls[0].parameters.options, {
    data: undefined,
    shouldCreateUser: false,
  });
  assert.equal(supabase.calls[1].parameters.type, "email");
});

test("sign-in for an unknown email reports no account instead of claiming a code was sent", async () => {
  const supabase = fakeSupabase({
    requestError: authError(422, "otp_disabled", "Signups not allowed for otp"),
  });

  const result = await requestEmailCode({
    supabase,
    email: "nobody@example.com",
    flow: "sign-in",
  });

  assert.deepEqual(result, { ok: false, outcome: "no-account" });
  assert.match(otpRequestMessage("sign-in", result.outcome), /create an account/);
});

test("a rejected send is never reported as sent, and rate limits get their own message", async () => {
  for (const error of [
    authError(429, "over_email_send_rate_limit", "email rate limit exceeded"),
    authError(429, "over_request_rate_limit"),
    authError(429, undefined),
  ]) {
    const result = await requestEmailCode({
      supabase: fakeSupabase({ requestError: error }),
      email: "busy@example.com",
      flow: "sign-up",
      fullName: "Busy Person",
    });

    assert.deepEqual(result, { ok: false, outcome: "rate-limited" });
  }

  assert.match(otpRequestMessage("sign-up", "rate-limited"), /Wait a few minutes/);
  assert.match(otpRequestMessage("sign-in", "unavailable"), /Nothing was sent/);
  assert.equal(classifyOtpRequestError(authError(500, "unexpected_failure")), "unavailable");
  assert.equal(classifyOtpRequestError(new Error("fetch failed")), "unavailable");
  assert.equal(otpRequestMessage("sign-in", undefined), "");
  // An unrecognised ?error= value still produces a safe message.
  assert.match(otpRequestMessage("sign-in", "anything"), /could not send a code/);
});

test("incorrect, expired and already-used codes share Supabase's error and one clear message", async () => {
  // Supabase answers all three with 403 otp_expired so a caller cannot tell
  // which codes exist.
  const supabase = fakeSupabase({
    verifyResult: {
      data: { session: null, user: null },
      error: authError(403, "otp_expired", "Token has expired or is invalid"),
    },
  });

  const result = await verifyEmailCode({
    supabase,
    email: "back@example.com",
    code: "000000",
  });

  assert.deepEqual(result, { ok: false, outcome: "invalid-code" });

  const message = otpVerifyMessage(result.outcome);
  assert.match(message, /didn't work/);
  assert.match(message, /latest code/);
  assert.match(message, /request a new one/);
});

test("verification rate limits and outages are distinguished from a bad code", () => {
  assert.equal(classifyOtpVerifyError(authError(429, "over_request_rate_limit")), "rate-limited");
  assert.equal(classifyOtpVerifyError(authError(500, "unexpected_failure")), "unavailable");
  assert.equal(classifyOtpVerifyError(new Error("fetch failed")), "unavailable");
  assert.match(otpVerifyMessage("rate-limited"), /Too many attempts/);
});

test("a verification without a session is not treated as signed in", async () => {
  const supabase = fakeSupabase({
    verifyResult: { data: { session: null, user: { id: "user-1" } }, error: null },
  });

  assert.deepEqual(
    await verifyEmailCode({ supabase, email: "back@example.com", code: "123456" }),
    { ok: false, outcome: "unavailable" },
  );
});

test("a malformed code is rejected locally without spending a verification attempt", async () => {
  const supabase = fakeSupabase();

  for (const code of ["", "12345", "1234567", "12345a", "12345678", null, undefined]) {
    assert.deepEqual(
      await verifyEmailCode({ supabase, email: "back@example.com", code }),
      { ok: false, outcome: "malformed-code" },
    );
  }

  assert.equal(supabase.calls.length, 0);
  assert.equal(normalizeOtpCode(" 123-456 "), "123456");
  assert.match(otpVerifyMessage("malformed-code"), /6-digit code/);
});

test("codes and emails are never written to the console", async () => {
  const methods = ["log", "info", "warn", "error", "debug"];
  const originals = methods.map((method) => console[method]);
  const logged = [];
  methods.forEach((method) => {
    console[method] = (...args) => logged.push(args);
  });

  try {
    const failing = fakeSupabase({
      requestError: authError(429, "over_email_send_rate_limit"),
      verifyResult: { data: {}, error: authError(403, "otp_expired") },
    });
    await requestEmailCode({ supabase: failing, email: "a@example.com", flow: "sign-in" });
    await verifyEmailCode({ supabase: failing, email: "a@example.com", code: "123456" });
    await verifyEmailCode({ supabase: fakeSupabase(), email: "a@example.com", code: "123456" });
  } finally {
    methods.forEach((method, index) => {
      console[method] = originals[index];
    });
  }

  assert.deepEqual(logged, []);
});

test("the resend cooldown counts down from the last accepted send", () => {
  const sentAt = 1_000_000;

  assert.equal(resendWaitSeconds(sentAt, sentAt), RESEND_COOLDOWN_SECONDS);
  assert.equal(resendWaitSeconds(sentAt, sentAt + 1_500), RESEND_COOLDOWN_SECONDS - 1);
  assert.equal(resendWaitSeconds(sentAt, sentAt + 59_000), 1);
  assert.equal(resendWaitSeconds(sentAt, sentAt + 60_000), 0);
  assert.equal(resendWaitSeconds(sentAt, sentAt + 3_600_000), 0);
  // A clock that moved backwards must not produce a longer wait than the cooldown.
  assert.equal(resendWaitSeconds(sentAt, sentAt - 30_000), RESEND_COOLDOWN_SECONDS);
});

test("the pending verification keeps the interrupted booking's return path", () => {
  const now = 2_000_000_000_000;
  const next = "/@glow.co/book/6f0c/checkout?time=2026-10-01T10%3A00&addOns=a,b";
  const cookie = serializePendingAuth({
    email: "customer@icloud.com",
    flow: "sign-up",
    next,
    sentAt: now - 5_000,
  });

  assert.deepEqual(parsePendingAuth(cookie, now), {
    email: "customer@icloud.com",
    flow: "sign-up",
    next,
    sentAt: now - 5_000,
  });
});

test("a tampered pending verification cannot redirect off-site or outlive the code", () => {
  const now = 2_000_000_000_000;
  const pending = (overrides) =>
    JSON.stringify({
      email: "customer@example.com",
      flow: "sign-in",
      next: "/account/bookings",
      sentAt: now,
      ...overrides,
    });

  for (const next of ["https://evil.example", "//evil.example", "/\\evil.example", 42]) {
    assert.equal(parsePendingAuth(pending({ next }), now).next, null);
  }

  assert.equal(parsePendingAuth(pending({ flow: "admin" }), now), null);
  assert.equal(parsePendingAuth(pending({ email: "not-an-email" }), now), null);
  assert.equal(parsePendingAuth(pending({ sentAt: "soon" }), now), null);
  assert.equal(parsePendingAuth(pending({ sentAt: now + 3_600_000 }), now), null);
  assert.equal(
    parsePendingAuth(pending({ sentAt: now - (PENDING_AUTH_MAX_AGE_SECONDS + 1) * 1000 }), now),
    null,
  );
  assert.equal(parsePendingAuth("not json", now), null);
  assert.equal(parsePendingAuth(undefined, now), null);
});

test("return paths accept only same-site absolute paths", () => {
  assert.equal(validatedNextPath("/dashboard/onboarding"), "/dashboard/onboarding");
  assert.equal(validatedNextPath("/account?tab=1"), "/account?tab=1");
  assert.equal(validatedNextPath("//evil.example"), null);
  assert.equal(validatedNextPath("https://evil.example"), null);
  assert.equal(validatedNextPath("/ok\r\nLocation: https://evil.example"), null);
  assert.equal(validatedNextPath(null), null);
});

test("return paths reject tab/newline smuggled protocol-relative redirects", () => {
  // `new URL(next, base)` strips ASCII tab and newline characters wherever
  // they occur before parsing, so "/\t/evil.example" would otherwise resolve
  // to the external origin "https://evil.example".
  const exploitPayloads = [
    "/\t/evil.example",
    "/\t\t/evil.example",
    "/\n/evil.example",
    "/\r/evil.example",
    "/\r\n/evil.example",
    "/foo/\t/evil.example",
  ];

  for (const payload of exploitPayloads) {
    assert.equal(
      validatedNextPath(payload),
      null,
      `expected ${JSON.stringify(payload)} to be rejected`,
    );

    const resolved = new URL(
      validatedNextPath(payload) ?? "/account",
      "https://ceaute.com",
    );
    assert.equal(resolved.origin, "https://ceaute.com");
  }
});

test("return paths reject other ASCII control characters", () => {
  const controlCharPayloads = [
    "/\x00/evil.example",
    "/\x08account",
    "/account\x7f",
    "/\x1b[31mevil",
  ];

  for (const payload of controlCharPayloads) {
    assert.equal(
      validatedNextPath(payload),
      null,
      `expected ${JSON.stringify(payload)} to be rejected`,
    );
  }
});

test("return paths still accept legitimate internal redirects", () => {
  const legitimatePaths = [
    "/",
    "/account",
    "/dashboard",
    "/dashboard/onboarding",
    "/@someprovider",
    "/@someprovider/book/123",
    "/account?tab=bookings&sort=date",
  ];

  for (const path of legitimatePaths) {
    assert.equal(validatedNextPath(path), path);
  }
});

test("emails are trimmed and validated before Supabase is asked", () => {
  assert.equal(normalizeEmail("  someone@icloud.com "), "someone@icloud.com");
  assert.equal(normalizeEmail("someone"), null);
  assert.equal(normalizeEmail(null), null);
});

test("the Supabase email templates show the code and contain no link to prefetch", () => {
  for (const name of ["confirmation", "magic_link"]) {
    const template = readFileSync(
      new URL(`../supabase/templates/${name}.html`, import.meta.url),
      "utf8",
    );

    assert.match(template, /\{\{ \.Token \}\}/);
    assert.doesNotMatch(template, /ConfirmationURL|TokenHash|SiteURL|RedirectTo|href=/);
  }
});
