"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { TextInput } from "@/components/ui/field";
import { AuthCard } from "./auth-card";

function signUpHref(next) {
  const params = new URLSearchParams();

  if (next) {
    params.set("next", next);
  }

  const query = params.toString();
  return query ? `/sign-up?${query}` : "/sign-up";
}

// T3 · Form. Sign-in is an emailed six-digit code verified at /verify — never
// a link and never a password. The action and its state are untouched.
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
    <AuthCard title="Log in">
      <p className="mt-1 text-body text-black/60">
        Continue to your Ceaute account.
      </p>

      <form className="mt-6 flex flex-col gap-[13px]" action={authenticateUserAction}>
        <TextInput
          name="email"
          label="Email"
          type="email"
          required
          autoFocus
          autoComplete="email"
          error={state?.message || undefined}
          helper="A code is emailed to you. No password."
        />
        <Button type="submit" disabled={pending} aria-disabled={pending}>
          {pending ? "Sending code…" : "Continue with email"}
        </Button>
      </form>

      <p className="mt-6 text-body text-black/60">
        New to Ceaute?{" "}
        <Link
          href={signUpHref(next)}
          className="font-medium text-plum transition duration-150 ease-out hover:text-plum-hover"
        >
          Get started
        </Link>
      </p>
    </AuthCard>
  );
}
