import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { VerifyCodeForm } from "../_components/verify-code-form";
import { submitCode } from "../actions";
import {
  PENDING_AUTH_COOKIE,
  RESEND_COOLDOWN_SECONDS,
  parsePendingAuth,
} from "@/lib/auth/email-otp";
import { createClient } from "@/lib/supabase/server";

function pathWithNext(path, next) {
  return next ? `${path}?${new URLSearchParams({ next })}` : path;
}

export default async function VerifyCodePage() {
  const cookieStore = await cookies();
  const pending = parsePendingAuth(cookieStore.get(PENDING_AUTH_COOKIE)?.value);
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();

  // The sign-in screen already knows where a signed-in user belongs, and is
  // also the right place to start again when no code is pending.
  if (data?.claims?.sub || !pending) {
    redirect(pathWithNext("/sign-in", pending?.next ?? null));
  }

  return (
    <VerifyCodeForm
      submitCode={submitCode}
      email={pending.email}
      isNewAccount={pending.flow === "sign-up"}
      changeEmailHref={pathWithNext(`/${pending.flow}`, pending.next)}
      resendAvailableAt={pending.sentAt + RESEND_COOLDOWN_SECONDS * 1000}
    />
  );
}
