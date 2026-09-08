"use client";
import Link from "next/link";
import Image from "next/image";
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
  initialState = { message: "" },
  next = null,
}) {
  const [state, createUserAction, pending] = useActionState(
    createUser,
    initialState,
  );
  return (
    <main className="container mx-auto max-w-md p-5">
      <div className="mt-12 flex flex-col">
        <Link href={"/"} className="flex w-max items-center gap-x-1">
          <span hidden className="relative h-6 w-6 overflow-hidden">
            <Image
              className="absolute select-none"
              fill="responsive"
              style={{ objectFit: "cover" }}
              src="/fleekd_logo.png"
              alt="fleekd-company-logo"
            />
          </span>
          <h2 className="select-none text-xs font-bold uppercase tracking-widest opacity-70">
            fleekd
          </h2>
        </Link>
        <h1 className="mt-8 text-2xl font-bold tracking-tight text-black/90">
          Create a Fleekd account
        </h1>
        <p className="font-medium text-black/70">
          One last step before starting.
        </p>
      </div>
      <form className="mt-6 grid gap-2" action={createUserAction}>
        <label htmlFor="full_name" className="text-sm">
          Full Name
        </label>
        <input
          id="full_name"
          name="full_name"
          type="text"
          required
          className="w-full appearance-none rounded-xl border p-3 outline-none ring-2 ring-transparent duration-200 hover:border-black/30 focus:border-pink-600 focus:ring-pink-200"
        />
        <label htmlFor="email" className="mt-4 text-sm">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          className="appearance-none rounded-xl border p-3 outline-none ring-2 ring-transparent duration-200 hover:border-black/30 focus:border-pink-600 focus:ring-pink-200"
        />

        <p className="mt-1 text-xs text-black/50">
          {" "}
          Your password must be at least 8 characters, and can’t begin or end
          with a space.{" "}
        </p>
        <p className="text-sm text-red-600">{state?.message}</p>
        <SubmitButton pending={pending} />
      </form>
      <p className="mt-6 text-sm">
        Already have a Fleekd account?{" "}
        <Link
          href={signInHref(next)}
          className="mt-4 text-pink-600 duration-200 hover:text-pink-700"
        >
          Log In
        </Link>
      </p>
      <div className="mt-8 flex gap-5">
        <Link
          href="/help"
          className="text-xs font-medium text-black/50 hover:underline"
        >
          Help
        </Link>
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
    </main>
  );
}

const SubmitButton = ({ pending }) => {
  return (
    <button
      type="submit"
      className="mt-4 rounded-lg bg-pink-600 p-2.5 text-sm font-medium text-white shadow-sm duration-200 hover:bg-pink-700 disabled:cursor-not-allowed disabled:opacity-60 aria-disabled:cursor-not-allowed aria-disabled:opacity-50"
      aria-disabled={pending}
      disabled={pending}
    >
      {!pending ? "Create Fleekd account" : "Submitting..."}
    </button>
  );
};
