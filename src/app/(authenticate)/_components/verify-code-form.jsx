"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import { EMAIL_OTP_LENGTH } from "@/lib/auth/email-otp";
import { Button } from "@/components/ui/button";
import { CodeInput } from "@/components/ui/code-input";
import { Field } from "@/components/ui/field";
import { AuthCard } from "./auth-card";

function useSecondsUntil(timestamp) {
  const [seconds, setSeconds] = useState(null);

  useEffect(() => {
    const update = () =>
      setSeconds(Math.max(0, Math.ceil((timestamp - Date.now()) / 1000)));

    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, [timestamp]);

  return seconds;
}

// T3 · Form, with the six-cell code entry. One form and one action for both
// buttons, so a single pending flag blocks duplicate submissions of either —
// unchanged from before; only the presentation moved.
export function VerifyCodeForm({
  submitCode,
  email,
  isNewAccount,
  changeEmailHref,
  resendAvailableAt,
}) {
  const [state, submitAction, pending] = useActionState(submitCode, {
    message: "",
    notice: "",
    resendAvailableAt,
  });
  const secondsLeft = useSecondsUntil(state.resendAvailableAt);
  // Until the first tick on the client the wait is unknown, so stay disabled.
  const canResend = secondsLeft === 0 && !pending;
  const [code, setCode] = useState("");

  return (
    <AuthCard title="Enter your code">
      <p className="mt-1 text-body text-black/60">
        A {EMAIL_OTP_LENGTH}-digit code was sent to{" "}
        <span className="break-all text-ink">{email}</span>
        {isNewAccount ? " to finish creating your account." : "."}
        {" Your time stays held."}
      </p>

      <form className="mt-6 flex flex-col gap-[13px]" action={submitAction}>
        <Field id="code" label="Verification code">
          <CodeInput
            id="code"
            name="code"
            length={EMAIL_OTP_LENGTH}
            autoFocus
            error={state?.message || undefined}
            onValueChange={setCode}
          />
        </Field>

        {state?.notice ? (
          <p className="text-[11.5px] text-black/45" role="status">
            {state.notice}
          </p>
        ) : null}

        {/* Continue stays disabled until all six digits are present. */}
        <Button
          type="submit"
          disabled={pending || code.length < EMAIL_OTP_LENGTH}
          aria-disabled={pending || code.length < EMAIL_OTP_LENGTH}
        >
          {pending ? "One moment…" : "Continue"}
        </Button>

        <p className="text-body text-black/60">
          Nothing arrived? Check your spam folder, or{" "}
          <button
            type="submit"
            name="intent"
            value="resend"
            formNoValidate
            disabled={!canResend}
            className="font-medium text-plum transition duration-150 ease-out hover:text-plum-hover disabled:text-black/40"
          >
            {secondsLeft ? `send a new code in ${secondsLeft}s` : "send a new code"}
          </button>
          .
        </p>
      </form>

      <p className="mt-4 text-body">
        <Link
          href={changeEmailHref}
          className="font-medium text-plum transition duration-150 ease-out hover:text-plum-hover"
        >
          Different email
        </Link>
      </p>

      <p className="mt-4 text-[12px] text-black/45">
        A new code replaces the old one.
      </p>
    </AuthCard>
  );
}
