"use client";

import Link from "next/link";
import { useActionState, useState } from "react";

const validateLength = (value, maxLength, label) => {
  if (value.length > maxLength) {
    return `${label} must be ${maxLength} characters or fewer.`;
  }

  return null;
};

export function LocationFormUI({ action, location = null }) {
  const [stateMessage, formAction, pending] = useActionState(action, "");
  const [errors, setErrors] = useState({});
  const editing = Boolean(location);

  const updateFieldError = (field, error) => {
    setErrors((currentErrors) => ({
      ...currentErrors,
      [field]: error,
    }));
  };

  const hasClientError = Object.values(errors).some(Boolean);

  return (
    <main className="container max-w-md p-5">
      <div className="mt-6 flex flex-col">
        <h1 className="text-3xl font-bold tracking-tighter">
          {editing ? "Edit location" : "Add location"}
        </h1>
        <p className="mt-2 text-sm text-black/60">
          The public area appears on your page. The exact address and access
          instructions stay private until a booking is confirmed.
        </p>

        <form
          id="save_location"
          className="mt-12 flex flex-col gap-4"
          action={formAction}
        >
          {editing ? (
            <input type="hidden" name="location_id" value={location.id} />
          ) : null}
          <span className="field-set">
            <label className="label" htmlFor="public_area">
              Public area
            </label>
            <p className="text-sm text-red-600">{errors.public_area ?? ""}</p>
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
          </span>

          <span className="field-set">
            <label className="label" htmlFor="address_line_1">
              Address line 1
            </label>
            <p className="text-sm text-red-600">
              {errors.address_line_1 ?? ""}
            </p>
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
          </span>

          <span className="field-set">
            <label className="label" htmlFor="address_line_2">
              Address line 2
            </label>
            <p className="text-sm text-red-600">
              {errors.address_line_2 ?? ""}
            </p>
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
          </span>

          <span className="field-set">
            <label className="label" htmlFor="city">
              City
            </label>
            <p className="text-sm text-red-600">{errors.city ?? ""}</p>
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
          </span>

          <span className="field-set">
            <label className="label" htmlFor="postcode">
              Postcode
            </label>
            <p className="text-sm text-red-600">{errors.postcode ?? ""}</p>
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
          </span>

          <span className="field-set">
            <label className="label" htmlFor="access_instructions">
              Access instructions
            </label>
            <textarea
              id="access_instructions"
              name="access_instructions"
              rows={5}
              defaultValue={location?.access_instructions ?? ""}
              className="field resize-none"
            />
          </span>

          <p className="mt-4 text-sm text-red-600">{stateMessage}</p>

          <div className="mt-8 flex items-center justify-end gap-2">
            <Link
              href="/dashboard/locations"
              className="w-max rounded-lg border border-black/10 p-3 px-6 text-sm font-semibold text-pink-600 duration-200 hover:border-black/20 active:border-transparent active:bg-pink-500/10 active:text-pink-500"
            >
              Back
            </Link>
            <button
              form="save_location"
              type="submit"
              disabled={pending || hasClientError}
              aria-disabled={pending || hasClientError}
              className="w-max rounded-lg bg-pink-700 p-3 px-4 text-sm font-semibold text-white shadow-sm duration-200 hover:bg-pink-800 disabled:cursor-not-allowed disabled:opacity-60 aria-disabled:cursor-not-allowed aria-disabled:opacity-50"
            >
              {pending ? "Saving..." : editing ? "Save" : "Add location"}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
