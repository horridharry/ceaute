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
    <main className="container mx-auto flex min-h-screen max-w-sm items-center px-5 py-12">
      <div className="flex w-full flex-col">
        <Link href={"/"} className="flex w-max items-center gap-x-1">
          <h2 className="select-none text-lg font-semibold tracking-tighter">
            Ceaute
          </h2>
        </Link>
        <h1 className="mt-10 text-2xl font-bold tracking-tight text-black/90">
          Enter your code
        </h1>
        <p className="mt-1 text-sm text-black/55">
          Code sent to{" "}
          <span className="break-all text-black/90">{email}</span>
          {isNewAccount ? " to finish creating your account." : "."}
        </p>

        <form className="mt-8 grid gap-2" action={submitAction}>
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
            className="w-full min-w-0 appearance-none rounded-lg border border-black/10 p-3 text-center text-2xl font-semibold tracking-[0.4em] outline-none ring-2 ring-transparent duration-200 hover:border-black/20 focus:border-pink-500 focus:ring-pink-100"
          />

          {state?.message ? (
            <p className="mt-1 text-sm text-red-600" role="alert">
              {state.message}
            </p>
          ) : null}
          {state?.notice ? (
            <p className="mt-1 text-sm text-black/55" role="status">
              {state.notice}
            </p>
          ) : null}
          <button
            type="submit"
            className="mt-4 cursor-pointer rounded-lg bg-pink-800 p-3 text-sm font-semibold text-white duration-200 hover:bg-pink-900 disabled:cursor-not-allowed disabled:opacity-30 aria-disabled:cursor-not-allowed aria-disabled:opacity-30
      active:opacity-60"
            aria-disabled={pending}
            disabled={pending}
          >
            {!pending ? "Continue" : "One moment..."}
          </button>

          <p className="mt-4 text-sm text-black/55">
            Didn&apos;t get it?{" "}
            <button
              type="submit"
              name="intent"
              value="resend"
              formNoValidate
              disabled={!canResend}
              className="cursor-pointer text-pink-600 duration-200 hover:text-pink-700 disabled:cursor-not-allowed disabled:text-black/40"
            >
              {secondsLeft ? `Resend in ${secondsLeft}s` : "Resend code"}
            </button>
          </p>
        </form>
        <p className="mt-3 text-sm">
          <Link
            href={changeEmailHref}
            className="text-pink-600 duration-200 hover:text-pink-700"
          >
            Use a different email
          </Link>
        </p>
      </div>
    </main>
  );
}
