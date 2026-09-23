"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { FormError } from "@/components/ui/form-feedback";
import { Input } from "@/components/ui/input";
import { updatePersonalDetails } from "../actions";

// Controlled inputs so a rejected save keeps what was typed instead of going
// back to the last saved value when the action completes.
export function PersonalDetailsForm({ fullName, phone }) {
  const [state, formAction, pending] = useActionState(updatePersonalDetails, null);
  const [fullNameValue, setFullNameValue] = useState(fullName);
  const [phoneValue, setPhoneValue] = useState(phone);
  const fieldErrors = state?.fieldErrors ?? {};

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      <Field label="Full name" htmlFor="full_name" error={fieldErrors.full_name ?? ""}>
        {(control) => (
          <Input
            {...control}
            name="full_name"
            autoComplete="name"
            value={fullNameValue}
            onChange={(event) => setFullNameValue(event.target.value)}
          />
        )}
      </Field>
      <Field
        label="Mobile number"
        htmlFor="phone"
        hint="A UK number. Providers use it to contact you about a booking."
        error={fieldErrors.phone ?? ""}
      >
        {(control) => (
          <Input
            {...control}
            name="phone"
            type="tel"
            autoComplete="tel"
            value={phoneValue}
            onChange={(event) => setPhoneValue(event.target.value)}
          />
        )}
      </Field>
      <FormError>{state?.status === "error" ? state.message : ""}</FormError>
      <div className="flex items-center gap-4">
        <Button type="submit" disabled={pending} aria-busy={pending || undefined}>
          {pending ? "Saving…" : "Save"}
        </Button>
        <p role="status" className="text-sm text-ink-muted">
          {state?.status === "saved" && !pending ? state.message : ""}
        </p>
      </div>
    </form>
  );
}
