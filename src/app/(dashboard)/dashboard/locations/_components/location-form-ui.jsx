"use client";

import { useActionState, useState } from "react";
import { FormTemplate } from "@/components/templates/form-template";
import { CommitBar } from "@/components/ui/commit-bar";
import { FieldPair, TextArea, TextInput } from "@/components/ui/field";
import { ProblemNotice } from "@/components/ui/notice";
import { SubmitButton } from "@/components/ui/submit-button";
import { StackedTopBar } from "@/components/ui/top-bar";

const validateLength = (value, maxLength, label) => {
  if (value.length > maxLength) {
    return `${label} must be ${maxLength} characters or fewer.`;
  }

  return null;
};

// T3 · Form, in two labelled halves. The visual split is the whole point:
// this is the screen where a woman decides whether to trust the product with
// her home address, so what is public and what is private are stated above
// the fields rather than left to be inferred.
//
// The same client-side length checks still gate the submit; the server action
// and its validation are untouched.
export function LocationFormUI({ location, updateLocation }) {
  const [stateMessage, updateLocationAction] = useActionState(
    updateLocation,
    "",
  );
  const [errors, setErrors] = useState({});

  const updateFieldError = (field, error) => {
    setErrors((currentErrors) => ({
      ...currentErrors,
      [field]: error,
    }));
  };

  const hasClientError = Object.values(errors).some(Boolean);
  const onChangeLength = (field, maxLength, label) => (event) =>
    updateFieldError(field, validateLength(event.target.value, maxLength, label));

  return (
    <FormTemplate
      id="update_location"
      action={updateLocationAction}
      nav={<StackedTopBar backHref="/dashboard/profile" backLabel="Your page" />}
      notice={
        stateMessage ? (
          <ProblemNotice title="That did not save">{stateMessage}</ProblemNotice>
        ) : null
      }
      commitBar={
        <CommitBar>
          <SubmitButton disabled={hasClientError} pendingLabel="Saving">
            Save location
          </SubmitButton>
        </CommitBar>
      }
    >
      <header className="flex flex-col gap-1">
        <h1 className="text-display text-pretty text-ink">Location</h1>
      </header>

      <div className="flex items-center gap-2">
        <span aria-hidden="true" className="block size-[7px] rounded-full bg-ok" />
        <p className="text-label uppercase text-black/45">
          Public — shown in Discover and on your page
        </p>
      </div>

      <TextInput
        name="public_area"
        label="Area"
        defaultValue={location.public_area}
        error={errors.public_area ?? undefined}
        helper="Keep it broad — a neighbourhood or town, not a street."
        onChange={onChangeLength("public_area", 120, "Public area")}
      />

      <div className="mt-2 flex items-center gap-2">
        <span aria-hidden="true" className="block size-[7px] rounded-full bg-plum" />
        <p className="text-label uppercase text-black/45">
          Private — only after a paid, confirmed booking
        </p>
      </div>

      <TextInput
        name="address_line_1"
        label="Address line 1"
        defaultValue={location.address_line_1}
        error={errors.address_line_1 ?? undefined}
        onChange={onChangeLength("address_line_1", 120, "Address line 1")}
      />
      <TextInput
        name="address_line_2"
        label="Address line 2"
        optional
        defaultValue={location.address_line_2}
        error={errors.address_line_2 ?? undefined}
        onChange={onChangeLength("address_line_2", 120, "Address line 2")}
      />
      <FieldPair>
        <TextInput
          name="city"
          label="City"
          defaultValue={location.city}
          error={errors.city ?? undefined}
          onChange={onChangeLength("city", 80, "City")}
        />
        <TextInput
          name="postcode"
          label="Postcode"
          defaultValue={location.postcode}
          error={errors.postcode ?? undefined}
          onChange={onChangeLength("postcode", 12, "Postcode")}
        />
      </FieldPair>
      <TextArea
        name="access_instructions"
        label="Access instructions"
        optional
        rows={4}
        defaultValue={location.access_instructions}
      />
    </FormTemplate>
  );
}
