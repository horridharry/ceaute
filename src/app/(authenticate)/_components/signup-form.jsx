"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { TextInput } from "@/components/ui/field";
import { AuthCard } from "./auth-card";

function signInHref(next) {
  const params = new URLSearchParams();

  if (next) {
    params.set("next", next);
  }

  const query = params.toString();
  return query ? `/sign-in?${query}` : "/sign-in";
}

// T3 · Form. One account covers booking and running a page; creating a
// provider page later does not create a second one.
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
    <AuthCard title="Create your account">
      <p className="mt-1 text-body text-black/60">
        One account to book, and to run a page if you want to.
      </p>

      <form className="mt-6 flex flex-col gap-[13px]" action={createUserAction}>
        <TextInput name="full_name" label="Full name" required autoComplete="name" />
        <TextInput
          name="email"
          label="Email"
          type="email"
          required
          autoComplete="email"
          error={state?.message || undefined}
          helper="We email a six-digit code to finish creating your account."
        />
        <Button type="submit" disabled={pending} aria-disabled={pending}>
          {pending ? "Sending code…" : "Create account"}
        </Button>
      </form>

      <p className="mt-6 text-body text-black/60">
        Already have a Ceaute account?{" "}
        <Link
          href={signInHref(next)}
          className="font-medium text-plum transition duration-150 ease-out hover:text-plum-hover"
        >
          Log in
        </Link>
      </p>

      <p className="mt-4 text-[12px]/[1.55] text-black/45">
        By continuing you agree to the Terms and Privacy policy.
      </p>
    </AuthCard>
  );
}
