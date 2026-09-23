"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { buttonClassName } from "@/components/ui/button-classes";
import { Field } from "@/components/ui/field";
import { FormError } from "@/components/ui/form-feedback";
import { Input } from "@/components/ui/input";
import { normalizeUsername, suggestUsername, validateUsername } from "@/lib/providers/username";

export function ProviderOnboardingForm({ action }) {
  const [state, formAction, pending] = useActionState(action, null);
  const [businessName, setBusinessName] = useState("");
  const [username, setUsername] = useState("");
  // A hand-typed username belongs to the person; an untouched one keeps
  // following the business name.
  const [usernameWasEdited, setUsernameWasEdited] = useState(false);
  const [usernameHint, setUsernameHint] = useState("");
  const fieldErrors = state?.fieldErrors ?? {};
  const usernameError = usernameHint || fieldErrors.username || "";

  const updateBusinessName = (event) => {
    const value = event.target.value;
    setBusinessName(value);

    if (!usernameWasEdited) {
      setUsername(suggestUsername(value));
      setUsernameHint("");
    }
  };

  const updateUsername = (event) => {
    const value = normalizeUsername(event.target.value);
    setUsernameWasEdited(true);
    setUsername(value);
    // Say what is wrong only once there is enough to judge.
    setUsernameHint(value.length >= 3 ? (validateUsername(value) ?? "") : "");
  };

  return (
    <form className="mt-8 flex flex-col gap-5" action={formAction} noValidate>
      <Field label="Business name" htmlFor="business_name" error={fieldErrors.business_name ?? ""}>
        {(control) => (
          <Input
            {...control}
            name="business_name"
            autoComplete="organization"
            maxLength={120}
            value={businessName}
            onChange={updateBusinessName}
          />
        )}
      </Field>

      <Field
        label="Username"
        htmlFor="username"
        hint={`Your page will be ceaute.com/@${username || "yourname"}. You can change it later in Profile.`}
        error={usernameError}
      >
        {(control) => (
          <span className="relative block">
            <span
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-ink-muted"
            >
              /@
            </span>
            <Input
              {...control}
              name="username"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              maxLength={30}
              value={username}
              onChange={updateUsername}
              className="w-full pl-9"
            />
          </span>
        )}
      </Field>

      <FormError>{state?.formError ?? ""}</FormError>

      <div className="mt-2 flex items-center justify-between gap-3">
        <Link href="/account" className={buttonClassName({ variant: "text", className: "text-ink-muted" })}>
          Not now
        </Link>
        <Button type="submit" disabled={pending} aria-busy={pending || undefined}>
          {pending ? "Creating…" : "Create page"}
        </Button>
      </div>
    </form>
  );
}
