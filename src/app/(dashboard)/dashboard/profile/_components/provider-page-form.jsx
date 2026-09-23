"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { FormActions } from "@/components/ui/form-actions";
import { FormError } from "@/components/ui/form-feedback";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { keepFormValuesOnSubmit } from "@/lib/forms/keep-form-values";
import { normalizeUsername, validateUsername } from "@/lib/providers/username";
import { PROVIDER_CATEGORIES } from "../_lib/provider-page-form-values";

export function ProviderPageForm({ providerPage, updateProviderPage }) {
  const [result, updateProviderPageAction, pending] = useActionState(updateProviderPage, null);
  const [businessName, setBusinessName] = useState(providerPage.businessName || "");
  const [username, setUsername] = useState(providerPage.username || "");
  const [usernameWasEdited, setUsernameWasEdited] = useState(Boolean(providerPage.username));
  const [providerCategory, setProviderCategory] = useState(providerPage.providerCategory || "");
  // Controlled so a failed save keeps the edited biography instead of
  // resetting the textarea to the last saved value.
  const [biography, setBiography] = useState(providerPage.biography || "");
  const [businessNameError, setBusinessNameError] = useState("");
  const [usernameError, setUsernameError] = useState("");

  const updateBusinessName = (event) => {
    const nextBusinessName = event.target.value;
    setBusinessName(nextBusinessName);
    setBusinessNameError(
      nextBusinessName && nextBusinessName.trim().length < 2
        ? "Business name must be at least 2 characters long."
        : "",
    );

    if (!usernameWasEdited) {
      const suggestedUsername = normalizeUsername(nextBusinessName);
      setUsername(suggestedUsername);
      setUsernameError(validateUsername(suggestedUsername) ?? "");
    }
  };

  const updateUsername = (event) => {
    const nextUsername = normalizeUsername(event.target.value);
    setUsernameWasEdited(true);
    setUsername(nextUsername);
    setUsernameError(validateUsername(nextUsername) ?? "");
  };

  const biographyError = biography.length > 500 ? "Biography must be 500 characters or fewer." : "";
  const hasClientError = Boolean(businessNameError || usernameError || biographyError);

  return (
    <form
      id="update_details"
      aria-label="Profile details"
      className="mt-6 flex flex-col gap-5"
      action={updateProviderPageAction}
      onSubmit={keepFormValuesOnSubmit(updateProviderPageAction)}
    >
      <Field label="Business name" htmlFor="business_name" error={businessNameError}>
        {(control) => (
          <Input {...control} name="business_name" maxLength={120} value={businessName} onChange={updateBusinessName} />
        )}
      </Field>

      <Field
        label="Username"
        htmlFor="username"
        hint={username ? `Your page: ceaute.com/@${username}` : "Your page’s address on Ceaute."}
        error={usernameError}
      >
        {(control) => (
          <span className="relative block">
            <span aria-hidden="true" className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-ink-muted">
              /@
            </span>
            <Input
              {...control}
              name="username"
              autoComplete="username"
              className="w-full pl-10"
              value={username}
              onChange={updateUsername}
            />
          </span>
        )}
      </Field>

      <Field label="Provider category" htmlFor="provider_category">
        {(control) => (
          <Select
            {...control}
            name="provider_category"
            value={providerCategory}
            onChange={(event) => setProviderCategory(event.target.value)}
          >
            <option value="">Select a category</option>
            {PROVIDER_CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </Select>
        )}
      </Field>

      <Field label="Biography" htmlFor="biography" hint={`${biography.length} / 500`} error={biographyError}>
        {(control) => (
          <Textarea
            {...control}
            name="biography"
            rows={5}
            maxLength={500}
            className="resize-none"
            value={biography}
            onChange={(event) => setBiography(event.target.value)}
          />
        )}
      </Field>

      <FormError>{result?.status === "error" ? result.message : ""}</FormError>
      <FormActions status={result?.status === "saved" && !pending ? "Saved" : ""}>
        <Button type="submit" disabled={pending || hasClientError} aria-busy={pending || undefined}>
          {pending ? "Saving…" : "Save"}
        </Button>
      </FormActions>
    </form>
  );
}
