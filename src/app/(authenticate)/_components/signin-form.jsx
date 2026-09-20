"use client";
import Link from "next/link";
import { useActionState } from "react";
import { authenticationFormPath } from "@/lib/auth/form-path";

export function SigninForm({
  authenticateUser,
  initialEmail = "",
  initialState = { message: "" },
  next = null,
}) {
  const [state, authenticateUserAction, pending] = useActionState(
    authenticateUser,
    initialState,
  );
  return (
    <main className="container mx-auto flex min-h-screen max-w-sm items-center px-5 py-12">
      <div className="flex w-full flex-col">
        <Link href={"/"} className="flex w-max items-center gap-x-1">
          <h2 className="select-none text-lg font-semibold tracking-tighter">
            Ceaute
          </h2>
        </Link>
        <h1 className="mt-10 text-2xl font-bold tracking-tight text-black/90">
          Log in
        </h1>

        <form className="mt-8 grid gap-2" action={authenticateUserAction}>
          <label htmlFor="email" className="text-sm">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            autoFocus
            defaultValue={initialEmail}
            className="appearance-none rounded-lg border border-black/10 p-3 outline-none ring-2 ring-transparent duration-200 hover:border-black/20 focus:border-pink-500 focus:ring-pink-100"
          />

          {state?.message ? (
            <p className="mt-1 text-sm text-red-600" role="alert">
              {state.message}
            </p>
          ) : null}
          <SubmitButton pending={pending} />
        </form>

        <p className="mt-6 text-sm">
          New to Ceaute?{" "}
          <Link
            href={authenticationFormPath("/sign-up", {
              next,
              email: initialEmail,
            })}
            className="mt-4 text-pink-600 duration-200 hover:text-pink-700"
          >
            Get started.
          </Link>
        </p>
        <div className="mt-8 flex gap-5 border-t border-black/10 pt-5">
          <Link
            href="/privacy"
            className="text-xs font-medium text-black/50 hover:underline"
          >
            Privacy
          </Link>
          <Link
            href="/terms"
            className="text-xs font-medium text-black/50 hover:underline"
          >
            Terms
          </Link>
        </div>
      </div>
    </main>
  );
}

const SubmitButton = ({ pending }) => {
  return (
    <button
      type="submit"
      className="mt-4 cursor-pointer rounded-lg bg-pink-800 p-3 text-sm font-semibold text-white duration-200 hover:bg-pink-900 disabled:cursor-not-allowed disabled:opacity-30 aria-disabled:cursor-not-allowed aria-disabled:opacity-30
      active:opacity-60"
      aria-disabled={pending}
      disabled={pending}
    >
      {!pending ? "Continue with email" : "Sending code..."}
    </button>
  );
};
