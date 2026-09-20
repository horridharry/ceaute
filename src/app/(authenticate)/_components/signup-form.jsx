"use client";
import Link from "next/link";
import { useActionState } from "react";

function signInHref(next) {
  const params = new URLSearchParams();

  if (next) {
    params.set("next", next);
  }

  const query = params.toString();
  return query ? `/sign-in?${query}` : "/sign-in";
}

export function SignupForm({
  createUser,
  initialEmail = "",
  initialState = { message: "" },
  next = null,
}) {
  const [state, createUserAction, pending] = useActionState(
    createUser,
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
          Create a Ceaute account
        </h1>

        <form className="mt-8 grid gap-2" action={createUserAction}>
          <label htmlFor="full_name" className="text-sm">
            Full Name
          </label>
          <input
            id="full_name"
            name="full_name"
            type="text"
            required
            className="w-full appearance-none rounded-lg border border-black/10 p-3 outline-none ring-2 ring-transparent duration-200 hover:border-black/20 focus:border-accent-600 focus:ring-accent-100"
          />
          <label htmlFor="email" className="mt-4 text-sm">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            defaultValue={initialEmail}
            className="appearance-none rounded-lg border border-black/10 p-3 outline-none ring-2 ring-transparent duration-200 hover:border-black/20 focus:border-accent-600 focus:ring-accent-100"
          />

          <p className="mt-1 text-xs text-black/50">
            We will email you a six-digit code to finish creating your account.
          </p>
          {state?.message ? (
            <p className="text-sm text-red-600" role="alert">
              {state.message}
            </p>
          ) : null}
          <SubmitButton pending={pending} />
        </form>
        <p className="mt-6 text-sm">
          Already have a Ceaute account?{" "}
          <Link
            href={signInHref(next)}
            className="mt-4 text-accent-600 duration-200 hover:text-accent-700"
          >
            Log In
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
      className="mt-4 cursor-pointer rounded-lg bg-accent-700 p-3 text-sm font-semibold text-white duration-200 hover:bg-accent-700 disabled:cursor-not-allowed disabled:opacity-30 aria-disabled:cursor-not-allowed aria-disabled:opacity-30
      active:opacity-60"
      aria-disabled={pending}
      disabled={pending}
    >
      {!pending ? "Create Ceaute account" : "Sending code..."}
    </button>
  );
};
