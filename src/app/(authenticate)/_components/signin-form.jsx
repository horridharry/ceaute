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
    <main className="container mx-auto flex min-h-screen max-w-md items-center justify-center p-2">
      <div className="flex w-full flex-col border rounded-2xl border-black/10 bg-white p-8">
        <Link href={"/"} className="flex w-max items-center gap-x-1">
          <h2 className="select-none text-xs font-bold uppercase tracking-widest opacity-70">
            ceaute
          </h2>
        </Link>
        <h1 className="mt-8 text-2xl font-bold tracking-tight text-black/90">
          Log in
        </h1>
        <p className="font-medium text-black/60">Continue to Ceaute account</p>

        <form className="mt-6 grid gap-2" action={authenticateUserAction}>
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
            className="appearance-none rounded-xl border border-black/20 p-3 outline-none ring-2 ring-transparent duration-200 hover:border-black/30 focus:border-pink-600 focus:ring-pink-200"
          />

          <p className="text-sm text-red-600">{state?.message}</p>
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
        <div className="mt-8 flex gap-5">
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
      className="cursor-pointer mt-4 rounded-lg bg-pink-800 p-2.5 text-sm font-medium text-white shadow-sm duration-200 hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-30 aria-disabled:cursor-not-allowed aria-disabled:opacity-30
      active:opacity-60"
      aria-disabled={pending}
      disabled={pending}
    >
      {!pending ? "Continue with email" : "Sending code..."}
    </button>
  );
};
