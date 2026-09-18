"use client";
import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import { EMAIL_OTP_LENGTH } from "@/lib/auth/email-otp";

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

export function VerifyCodeForm({
  submitCode,
  email,
  isNewAccount,
  changeEmailHref,
  resendAvailableAt,
}) {
  // One form and one action for both buttons, so a single pending flag blocks
  // duplicate submissions of either.
  const [state, submitAction, pending] = useActionState(submitCode, {
    message: "",
    notice: "",
    resendAvailableAt,
  });
  const secondsLeft = useSecondsUntil(state.resendAvailableAt);
  // Until the first tick on the client the wait is unknown, so stay disabled.
  const canResend = secondsLeft === 0 && !pending;

  return (
    <main className="container mx-auto flex min-h-screen max-w-md items-center justify-center p-2">
      <div className="flex w-full flex-col border rounded-2xl border-black/10 bg-white p-8">
        <Link href={"/"} className="flex w-max items-center gap-x-1">
          <h2 className="select-none text-xs font-bold uppercase tracking-widest opacity-70">
            ceaute
          </h2>
        </Link>
        <h1 className="mt-8 text-2xl font-bold tracking-tight text-black/90">
          Enter your code
        </h1>
        <p className="font-medium text-black/60">
          We sent a {EMAIL_OTP_LENGTH}-digit code to{" "}
          <span className="break-all text-black/90">{email}</span>
          {isNewAccount ? " to finish creating your account." : "."}
        </p>

        <form className="mt-6 grid gap-2" action={submitAction}>
          <label htmlFor="code" className="text-sm">
            Verification code
          </label>
          <input
            id="code"
            name="code"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={EMAIL_OTP_LENGTH + 4}
            required
            autoFocus
            className="w-full min-w-0 appearance-none rounded-xl border border-black/20 p-3 text-center text-2xl font-semibold tracking-[0.4em] outline-none ring-2 ring-transparent duration-200 hover:border-black/30 focus:border-plum focus:ring-plum/20"
          />

          <p className="text-sm text-bad" role="alert">
            {state?.message}
          </p>
          <p className="text-sm text-black/60" role="status">
            {state?.notice}
          </p>
          <button
            type="submit"
            className="cursor-pointer mt-2 rounded-lg bg-plum p-2.5 text-sm font-medium text-white shadow-sm duration-200 hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-30 aria-disabled:cursor-not-allowed aria-disabled:opacity-30
      active:opacity-60"
            aria-disabled={pending}
            disabled={pending}
          >
            {!pending ? "Continue" : "One moment..."}
          </button>

          <p className="mt-4 text-sm text-black/60">
            Nothing arrived? Check your spam folder, or{" "}
            <button
              type="submit"
              name="intent"
              value="resend"
              formNoValidate
              disabled={!canResend}
              className="cursor-pointer text-plum duration-200 hover:text-plum-hover disabled:cursor-not-allowed disabled:text-black/40"
            >
              {secondsLeft ? `send a new code in ${secondsLeft}s` : "send a new code"}
            </button>
            .
          </p>
        </form>
        <p className="mt-2 text-sm">
          <Link
            href={changeEmailHref}
            className="text-plum duration-200 hover:text-plum-hover"
          >
            Use a different email
          </Link>
        </p>
      </div>
    </main>
  );
}
