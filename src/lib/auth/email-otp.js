import { validatedNextPath } from "./redirect";

// Email sign-in and sign-up use a six-digit code that Supabase Auth generates,
// emails and verifies. Ceaute never creates, stores or logs a code; this module
// only validates input, remembers which email is being verified between the two
// screens, and turns Supabase's errors into outcomes the screens can explain.

export const EMAIL_OTP_LENGTH = 6;
// Supabase refuses a second email to the same address inside its own window
// (60 seconds by default). The screens mirror it so the button does not offer
// a request that would be rejected.
export const RESEND_COOLDOWN_SECONDS = 60;
export const PENDING_AUTH_COOKIE = "ceaute_pending_auth";
// A pending verification is forgotten after an hour, the longest a Supabase
// email code can live.
export const PENDING_AUTH_MAX_AGE_SECONDS = 60 * 60;

const FLOWS = new Set(["sign-in", "sign-up"]);

export function normalizeEmail(value) {
  const email = typeof value === "string" ? value.trim() : "";
  return /^\S+@\S+\.\S+$/.test(email) ? email : null;
}

// People paste codes with spaces or a dash from the email. Anything that is
// not exactly six digits afterwards is rejected before Supabase is asked, so a
// typo does not spend a verification attempt.
export function normalizeOtpCode(value) {
  const code = typeof value === "string" ? value.replace(/[\s-]/g, "") : "";
  return new RegExp(`^\\d{${EMAIL_OTP_LENGTH}}$`).test(code) ? code : null;
}

export function serializePendingAuth({ email, flow, next = null, sentAt }) {
  return JSON.stringify({ email, flow, next, sentAt });
}

// The cookie is httpOnly but still client-held, so every field is validated
// again. In particular `next` goes back through the same open-redirect check
// the sign-in screen uses.
export function parsePendingAuth(value, now = Date.now()) {
  if (typeof value !== "string" || !value) {
    return null;
  }

  let parsed;
  try {
    parsed = JSON.parse(value);
  } catch {
    return null;
  }

  const email = normalizeEmail(parsed?.email);
  const sentAt = Number(parsed?.sentAt);

  if (
    !email ||
    !FLOWS.has(parsed?.flow) ||
    !Number.isFinite(sentAt) ||
    sentAt > now + 60_000 ||
    now - sentAt > PENDING_AUTH_MAX_AGE_SECONDS * 1000
  ) {
    return null;
  }

  return {
    email,
    flow: parsed.flow,
    next: validatedNextPath(parsed.next),
    sentAt,
  };
}

export function resendWaitSeconds(sentAt, now = Date.now()) {
  const elapsed = Math.floor((now - sentAt) / 1000);
  return Math.min(
    RESEND_COOLDOWN_SECONDS,
    Math.max(0, RESEND_COOLDOWN_SECONDS - elapsed),
  );
}

function isRateLimited(error) {
  return (
    error?.status === 429 ||
    error?.code === "over_email_send_rate_limit" ||
    error?.code === "over_request_rate_limit"
  );
}

// Outcomes of asking Supabase to email a code.
export function classifyOtpRequestError(error) {
  if (isRateLimited(error)) {
    return "rate-limited";
  }

  // signInWithOtp with shouldCreateUser: false answers this for an unknown
  // email, which is how sign-in keeps refusing to create accounts.
  if (error?.code === "otp_disabled" || error?.code === "user_not_found") {
    return "no-account";
  }

  if (
    error?.code === "email_address_invalid" ||
    error?.code === "validation_failed"
  ) {
    return "invalid-email";
  }

  return "unavailable";
}

// Supabase deliberately answers a wrong, an expired and an already-used code
// with the same `otp_expired` error, so the screen explains all three at once.
export function classifyOtpVerifyError(error) {
  if (isRateLimited(error)) {
    return "rate-limited";
  }

  if (
    error?.code === "otp_expired" ||
    error?.code === "otp_disabled" ||
    error?.code === "validation_failed" ||
    error?.status === 403 ||
    error?.status === 401
  ) {
    return "invalid-code";
  }

  return "unavailable";
}

const REQUEST_MESSAGES = {
  "sign-in": {
    "invalid-email": "Enter a valid email address.",
    "no-account":
      "We could not find a Ceaute account for that email. Check the address or create an account.",
    "rate-limited":
      "Too many codes have been requested. Wait a few minutes before trying again, and check your inbox and spam folder for a code we already sent.",
    unavailable: "We could not send a code just now. Nothing was sent. Try again shortly.",
  },
  "sign-up": {
    "invalid-email": "Enter a valid email address.",
    "invalid-name": "Enter your full name.",
    "rate-limited":
      "Too many codes have been requested. Wait a few minutes before trying again, and check your inbox and spam folder for a code we already sent.",
    unavailable:
      "We could not send a code just now. Nothing was sent. Check the details and try again shortly.",
  },
};

export function otpRequestMessage(flow, outcome) {
  if (!outcome) {
    return "";
  }

  const messages = REQUEST_MESSAGES[flow] ?? REQUEST_MESSAGES["sign-in"];
  return messages[outcome] ?? messages.unavailable;
}

const VERIFY_MESSAGES = {
  "malformed-code": `Enter the ${EMAIL_OTP_LENGTH}-digit code from the email.`,
  "invalid-code":
    "That code didn't work. Try the latest code or request a new one.",
  "rate-limited": "Too many attempts. Wait a few minutes before trying again.",
  unavailable: "We could not check the code just now. Try again shortly.",
};

export function otpVerifyMessage(outcome) {
  return outcome ? (VERIFY_MESSAGES[outcome] ?? VERIFY_MESSAGES.unavailable) : "";
}

// Asks Supabase to email a code. Sign-in never creates an account and sign-up
// may, exactly as the magic-link flow behaved. No redirect URL is sent because
// the email carries a code, not a link.
export async function requestEmailCode({ supabase, email, flow, fullName }) {
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      data: flow === "sign-up" && fullName ? { full_name: fullName } : undefined,
      shouldCreateUser: flow === "sign-up",
    },
  });

  return error ? { ok: false, outcome: classifyOtpRequestError(error) } : { ok: true };
}

// `email` is Supabase's OTP type for a code requested through signInWithOtp.
// It covers both cases: it confirms a new account's first code and signs a
// returning user in, replacing the older `signup` and `magiclink` types.
export async function verifyEmailCode({ supabase, email, code }) {
  const token = normalizeOtpCode(code);

  if (!token) {
    return { ok: false, outcome: "malformed-code" };
  }

  const { data, error } = await supabase.auth.verifyOtp({
    email,
    token,
    type: "email",
  });

  if (error) {
    return { ok: false, outcome: classifyOtpVerifyError(error) };
  }

  if (!data?.session || !data?.user?.id) {
    return { ok: false, outcome: "unavailable" };
  }

  return { ok: true, userId: data.user.id };
}
