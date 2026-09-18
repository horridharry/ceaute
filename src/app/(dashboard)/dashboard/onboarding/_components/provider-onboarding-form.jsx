"use client";

import { useActionState, useState } from "react";
import { FormTemplate } from "@/components/templates/form-template";
import { CommitBar } from "@/components/ui/commit-bar";
import { Field, TextArea, TextInput } from "@/components/ui/field";
import { ProblemNotice } from "@/components/ui/notice";
import { SubmitButton } from "@/components/ui/submit-button";
import { StackedTopBar } from "@/components/ui/top-bar";
import { normalizeUsername, validateUsername } from "../../_lib/username";

// T3 · Form. Creating a draft page: nothing is public until she publishes.
// The username still follows the business name until she edits it, and the
// same client-side validation still gates the submit — only the clothes moved.
export function ProviderOnboardingForm({ action, providerPage }) {
  // SubmitButton reads the pending flag from the surrounding form, so this
  // component does not need to hold one of its own.
  const [stateMessage, formAction] = useActionState(action, "");
  const [businessName, setBusinessName] = useState(providerPage.businessName);
  const [username, setUsername] = useState(providerPage.username);
  // A saved or hand-typed username belongs to the user; only an untouched one
  // keeps following the business name.
  const [usernameWasEdited, setUsernameWasEdited] = useState(
    Boolean(providerPage.username),
  );
  const [usernameError, setUsernameError] = useState("");
  // Controlled like the other fields so a failed submission does not reset it.
  const [biography, setBiography] = useState(providerPage.biography);

  const updateBusinessName = (event) => {
    const value = event.target.value;
    setBusinessName(value);

    if (!usernameWasEdited) {
      const suggestedUsername = normalizeUsername(value);
      setUsername(suggestedUsername);
      setUsernameError(validateUsername(suggestedUsername) ?? "");
    }
  };

  const updateUsername = (event) => {
    const value = normalizeUsername(event.target.value);
    setUsernameWasEdited(true);
    setUsername(value);
    setUsernameError(validateUsername(value) ?? "");
  };

  return (
    <FormTemplate
      action={formAction}
      nav={<StackedTopBar backHref="/account" backLabel="Account" />}
      notice={
        stateMessage ? (
          <ProblemNotice title="That did not save">{stateMessage}</ProblemNotice>
        ) : null
      }
      commitBar={
        <CommitBar contextDetail="Then: location, hours, a treatment, terms, a photo, Stripe.">
          <SubmitButton
            block={false}
            disabled={Boolean(usernameError)}
            pendingLabel="Creating your draft"
            className="px-6"
          >
            Create draft page
          </SubmitButton>
        </CommitBar>
      }
    >
      <header className="flex flex-col gap-1">
        <h1 className="text-display text-pretty text-ink">Create your page</h1>
        <p className="text-meta text-black/50">
          This makes a draft. Nothing is public until you publish.
        </p>
      </header>

      <TextInput
        name="business_name"
        label="Business name"
        required
        value={businessName}
        onChange={updateBusinessName}
      />

      <Field
        id="username"
        label="Username"
        error={usernameError || undefined}
        helper={usernameError ? undefined : "This is the link for your Instagram bio."}
      >
        <div className="relative">
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 left-[13px] flex items-center text-[14px] text-black/45"
          >
            ceaute.com/@
          </span>
          <input
            id="username"
            name="username"
            autoComplete="username"
            required
            value={username}
            onChange={updateUsername}
            aria-invalid={usernameError ? true : undefined}
            className="field pl-[105px]"
          />
        </div>
      </Field>

      <TextArea
        name="biography"
        label="Biography"
        optional
        rows={4}
        maxLength={500}
        value={biography}
        onChange={(event) => setBiography(event.target.value)}
      />
    </FormTemplate>
  );
}
