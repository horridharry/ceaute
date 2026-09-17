"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  PENDING_AUTH_COOKIE,
  PENDING_AUTH_MAX_AGE_SECONDS,
  RESEND_COOLDOWN_SECONDS,
  normalizeEmail,
  otpRequestMessage,
  otpVerifyMessage,
  parsePendingAuth,
  requestEmailCode,
  resendWaitSeconds,
  serializePendingAuth,
  verifyEmailCode,
} from "@/lib/auth/email-otp";
import { validatedNextPath } from "@/lib/auth/redirect";
import { createClient } from "@/lib/supabase/server";

const VERIFY_PATH = "/verify";

function authenticatePath(path, statusName, statusValue, nextValue) {
  const params = new URLSearchParams({
    [statusName]: statusValue,
  });

  if (nextValue) {
    params.set("next", nextValue);
  }

  return `${path}?${params.toString()}`;
}

// The email being verified travels between the two screens in an httpOnly
// cookie rather than the URL, so it survives a reload (phones often reload the
// tab after a trip to the mail app) without appearing in history or logs.
async function readPendingAuth() {
  const cookieStore = await cookies();
  return parsePendingAuth(cookieStore.get(PENDING_AUTH_COOKIE)?.value);
}

async function writePendingAuth(pending) {
  const cookieStore = await cookies();
  cookieStore.set(PENDING_AUTH_COOKIE, serializePendingAuth(pending), {
    httpOnly: true,
    maxAge: PENDING_AUTH_MAX_AGE_SECONDS,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
}

async function sendEmailCode(flow, path, nextValue, formData) {
  const email = normalizeEmail(formData.get("email"));
  const next = validatedNextPath(nextValue);
  const fullNameValue = formData.get("full_name");
  const fullName = typeof fullNameValue === "string" ? fullNameValue.trim() : "";

  if (!email) {
    redirect(authenticatePath(path, "error", "invalid-email", next));
  }

  if (flow === "sign-up" && fullName.length < 2) {
    redirect(authenticatePath(path, "error", "invalid-name", next));
  }

  // A second request replaces the code in the first email and counts against
  // the email rate limit. While the cooldown runs, return to the code screen
  // for the email already sent instead of asking Supabase again.
  const pending = await readPendingAuth();

  if (
    pending &&
    pending.flow === flow &&
    pending.email.toLowerCase() === email.toLowerCase() &&
    resendWaitSeconds(pending.sentAt) > 0
  ) {
    await writePendingAuth({ ...pending, next });
    redirect(VERIFY_PATH);
  }

  const supabase = await createClient();
  const result = await requestEmailCode({ supabase, email, flow, fullName });

  if (!result.ok) {
    redirect(authenticatePath(path, "error", result.outcome, next));
  }

  await writePendingAuth({ email, flow, next, sentAt: Date.now() });
  redirect(VERIFY_PATH);
}

export async function authenticateUser(next, prevState, formData) {
  await sendEmailCode("sign-in", "/sign-in", next, formData);
}

export async function createUser(next, prevState, formData) {
  await sendEmailCode("sign-up", "/sign-up", next, formData);
}

async function verifyCode(prevState, formData) {
  const pending = await readPendingAuth();

  if (!pending) {
    redirect("/sign-in");
  }

  const supabase = await createClient();
  const result = await verifyEmailCode({
    supabase,
    email: pending.email,
    code: formData.get("code"),
  });

  if (!result.ok) {
    return { ...prevState, notice: "", message: otpVerifyMessage(result.outcome) };
  }

  const cookieStore = await cookies();
  cookieStore.delete(PENDING_AUTH_COOKIE);

  // Without a return path the sign-in screen chooses between the dashboard
  // and the account area for the now signed-in user.
  redirect(pending.next ?? "/sign-in");
}

async function resendCode(prevState) {
  const pending = await readPendingAuth();

  if (!pending) {
    redirect("/sign-in");
  }

  const waitSeconds = resendWaitSeconds(pending.sentAt);

  if (waitSeconds > 0) {
    return {
      ...prevState,
      notice: "",
      message: `You can request a new code in ${waitSeconds} seconds.`,
    };
  }

  const supabase = await createClient();
  const result = await requestEmailCode({
    supabase,
    email: pending.email,
    flow: pending.flow,
  });

  if (!result.ok) {
    return {
      ...prevState,
      notice: "",
      message: otpRequestMessage(pending.flow, result.outcome),
      // Nothing was sent, but hold the button back so a rate-limited person
      // cannot keep extending the limit by pressing it.
      resendAvailableAt: Date.now() + RESEND_COOLDOWN_SECONDS * 1000,
    };
  }

  const sentAt = Date.now();
  await writePendingAuth({ ...pending, sentAt });

  return {
    message: "",
    notice: "We sent a new code. Earlier codes no longer work.",
    resendAvailableAt: sentAt + RESEND_COOLDOWN_SECONDS * 1000,
  };
}

// The code screen is one form with two buttons, so both share one pending
// state and a resend cannot race a verification.
export async function submitCode(prevState, formData) {
  return formData.get("intent") === "resend"
    ? resendCode(prevState)
    : verifyCode(prevState, formData);
}

export async function logoutUser() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/sign-in");
}

export const signOut = logoutUser;
