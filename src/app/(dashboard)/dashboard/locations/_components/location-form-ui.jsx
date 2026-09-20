"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { PendingButton } from "@/components/pending-button";
import { FormField } from "../../_components/form-field";
import { FocusedTaskHeader } from "../../_components/focused-task-header";

const validateLength = (value, maxLength, label) => {
  if (value.length > maxLength) {
    return `${label} must be ${maxLength} characters or fewer.`;
  }

  return null;
};

export function LocationFormUI({ action, location = null }) {
  const [stateMessage, formAction] = useActionState(action, "");
  const [errors, setErrors] = useState({});
  const editing = Boolean(location);

  const updateFieldError = (field, error) => {
    setErrors((currentErrors) => ({
      ...currentErrors,
      [field]: error,
    }));
  };

  return (
    <main className="container max-w-md p-5">
      <div className="mt-6 flex flex-col">
        <FocusedTaskHeader
          backHref="/dashboard/locations"
          backLabel="Locations"
          title={editing ? "Edit location" : "New location"}
        />
        <p className="mt-2 text-sm text-black/60">
          The public area appears on your page. The exact address stays private
          until a booking is confirmed.
        </p>

        <form
          id="save_location"
          className="mt-8 flex flex-col gap-4"
          action={formAction}
        >
          {editing ? (
            <input type="hidden" name="location_id" value={location.id} />
          ) : null}
          <FormField
            label="Public area"
            htmlFor="public_area"
            error={errors.public_area}
          >
            <input
              id="public_area"
              name="public_area"
              defaultValue={location?.public_area ?? ""}
              onChange={(event) =>
                updateFieldError(
                  "public_area",
                  validateLength(event.target.value, 120, "Public area"),
                )
              }
              className="field"
              placeholder="Shoreditch, London"
            />
          </FormField>

          <FormField
            label="Address line 1"
            htmlFor="address_line_1"
            error={errors.address_line_1}
          >
            <input
              id="address_line_1"
              name="address_line_1"
              defaultValue={location?.address_line_1 ?? ""}
              onChange={(event) =>
                updateFieldError(
                  "address_line_1",
                  validateLength(event.target.value, 160, "Address line 1"),
                )
              }
              className="field"
            />
          </FormField>

          <FormField
            label="Address line 2"
            htmlFor="address_line_2"
            error={errors.address_line_2}
          >
            <input
              id="address_line_2"
              name="address_line_2"
              defaultValue={location?.address_line_2 ?? ""}
              onChange={(event) =>
                updateFieldError(
                  "address_line_2",
                  validateLength(event.target.value, 160, "Address line 2"),
                )
              }
              className="field"
            />
          </FormField>

          <FormField
            label="City"
            htmlFor="city"
            error={errors.city}
          >
            <input
              id="city"
              name="city"
              defaultValue={location?.city ?? ""}
              onChange={(event) =>
                updateFieldError(
                  "city",
                  validateLength(event.target.value, 100, "City"),
                )
              }
              className="field"
            />
          </FormField>

          <FormField
            label="Postcode"
            htmlFor="postcode"
            error={errors.postcode}
          >
            <input
              id="postcode"
              name="postcode"
              defaultValue={location?.postcode ?? ""}
              onChange={(event) =>
                updateFieldError(
                  "postcode",
                  validateLength(event.target.value, 12, "Postcode"),
                )
              }
              className="field"
            />
          </FormField>

          <FormField
            label="Access instructions"
            htmlFor="access_instructions"
          >
            <textarea
              id="access_instructions"
              name="access_instructions"
              rows={5}
              defaultValue={location?.access_instructions ?? ""}
              className="field resize-none"
            />
          </FormField>

          {stateMessage ? (
            <p className="mt-4 text-sm text-red-600">{stateMessage}</p>
          ) : null}
          <PendingButton
            pendingLabel="Saving..."
            className="mt-1 w-full rounded-[11px] bg-accent-600 py-3.5 text-sm font-medium text-white disabled:opacity-40"
          >
            {editing ? "Save" : "Add"}
          </PendingButton>
          <Link
            href="/dashboard/locations"
            className="block py-1 text-center text-sm font-medium text-black/50"
          >
            Discard
          </Link>
        </form>
      </div>
    </main>
  );
}
