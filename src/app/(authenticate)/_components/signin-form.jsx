"use client";
import Link from "next/link";
import { useActionState } from "react";

function signUpHref(next) {
  const params = new URLSearchParams();

  if (next) {
    params.set("next", next);
  }

  const query = params.toString();
  return query ? `/sign-up?${query}` : "/sign-up";
}

export function SigninForm({
  authenticateUser,
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
            className="appearance-none rounded-xl border border-black/20 p-3 outline-none ring-2 ring-transparent duration-200 hover:border-black/30 focus:border-plum focus:ring-plum/20"
          />

          <p className="text-sm text-red-600">{state?.message}</p>
          <SubmitButton pending={pending} />
        </form>

        <p className="mt-6 text-sm">
          New to Ceaute?{" "}
          <Link
            href={signUpHref(next)}
            className="mt-4 text-plum duration-200 hover:text-plum-hover"
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
      className="cursor-pointer mt-4 rounded-lg bg-plum p-2.5 text-sm font-medium text-white shadow-sm duration-200 hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-30 aria-disabled:cursor-not-allowed aria-disabled:opacity-30
      active:opacity-60"
      aria-disabled={pending}
      disabled={pending}
    >
      {!pending ? "Continue with email" : "Sending code..."}
    </button>
  );
};
