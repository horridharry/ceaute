"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { FormActions } from "@/components/ui/form-actions";
import { FormError } from "@/components/ui/form-feedback";
import { Input } from "@/components/ui/input";
import { PageContainer } from "@/components/ui/page-container";
import { Textarea } from "@/components/ui/textarea";
import { FocusedTaskHeader } from "../../_components/focused-task-header";

const validateLength = (value, maxLength, label) =>
  value.length > maxLength ? `${label} must be ${maxLength} characters or fewer.` : "";

// One length-checked text field; the limits match readLocationDetails.
function LocationInput({ id, label, maxLength, optional = false, location, errors, onCheck, ...rest }) {
  return (
    <Field label={label} htmlFor={id} optional={optional} error={errors[id]}>
      {(control) => (
        <Input
          {...control}
          name={id}
          className="w-full"
          defaultValue={location?.[id] ?? ""}
          onChange={(event) => onCheck(id, validateLength(event.target.value, maxLength, label))}
          {...rest}
        />
      )}
    </Field>
  );
}

export function LocationFormUI({ action, location = null }) {
  const [stateMessage, formAction, pending] = useActionState(action, "");
  const [errors, setErrors] = useState({});
  const editing = Boolean(location);
  const onCheck = (field, error) => setErrors((current) => ({ ...current, [field]: error }));
  const hasClientError = Object.values(errors).some(Boolean);
  const shared = { location, errors, onCheck };

  return (
    <PageContainer>
      <FocusedTaskHeader
        backHref="/dashboard/locations"
        title={editing ? "Edit location" : "New location"}
      />
      <p className="mt-5 text-sm text-ink-muted">
        The public area appears on your page. The exact address stays private
        until a booking is confirmed.
      </p>

      <form id="save_location" className="mt-6 flex flex-col gap-5" action={formAction}>
        {editing ? <input type="hidden" name="location_id" value={location.id} /> : null}
        <LocationInput id="public_area" label="Public area" maxLength={120} placeholder="Shoreditch, London" {...shared} />
        <LocationInput id="address_line_1" label="Address line 1" maxLength={160} {...shared} />
        <LocationInput id="address_line_2" label="Address line 2" maxLength={160} optional {...shared} />
        <div className="grid grid-cols-2 gap-2.5">
          <LocationInput id="city" label="City" maxLength={100} {...shared} />
          <LocationInput id="postcode" label="Postcode" maxLength={12} {...shared} />
        </div>
        <Field label="Access instructions" htmlFor="access_instructions" optional>
          {(control) => (
            <Textarea
              {...control}
              name="access_instructions"
              rows={4}
              className="resize-none"
              defaultValue={location?.access_instructions ?? ""}
            />
          )}
        </Field>

        <FormError>{stateMessage}</FormError>
        <FormActions>
          <Button type="submit" disabled={pending || hasClientError} aria-busy={pending || undefined}>
            {pending ? (editing ? "Saving…" : "Adding…") : editing ? "Save" : "Add location"}
          </Button>
        </FormActions>
      </form>
    </PageContainer>
  );
}
