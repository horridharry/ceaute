"use client";

import { useActionState, useMemo, useState } from "react";
import { FormField } from "../../_components/form-field";
import { FocusedTaskHeader } from "../../_components/focused-task-header";

function ErrorMessage({ message }) {
  return message ? <p className="text-sm text-red-600">{message}</p> : null;
}

function ArchiveButton({ addOn, archiveAction, restoreAction, pending }) {
  const [message, formAction, archivePending] = useActionState(
    addOn.is_active ? archiveAction : restoreAction,
    "",
  );
  const isPending = pending || archivePending;
  const isArchived = !addOn.is_active;

  return (
    <form action={formAction} className="mr-auto">
      <input type="hidden" name="addOnId" value={addOn.addOnId} />
      <button
        type="submit"
        className="w-max rounded-lg p-3 px-6 text-sm font-semibold text-rose-600 duration-200 hover:border-transparent hover:bg-rose-50/80 active:bg-rose-600 active:text-white disabled:cursor-not-allowed disabled:opacity-60 aria-disabled:cursor-not-allowed aria-disabled:opacity-60"
        aria-disabled={isPending}
        disabled={isPending}
      >
        {archivePending
          ? isArchived
            ? "Restoring..."
            : "Archiving..."
          : isArchived
            ? "Restore"
            : "Archive"}
      </button>
      {message ? <p className="mt-2 text-sm text-red-600">{message}</p> : null}
    </form>
  );
}

export function TreatmentAddOnForm({
  action,
  archiveAction,
  restoreAction,
  addOn,
  mode,
  treatments,
}) {
  const [stateMessage, formAction, pending] = useActionState(action, "");
  const [name, setName] = useState(addOn?.name ?? "");
  const [additionalPrice, setAdditionalPrice] = useState(
    addOn ? String(addOn.additional_price) : "0",
  );
  const [additionalDuration, setAdditionalDuration] = useState(
    addOn ? String(addOn.additional_duration_minutes) : "0",
  );
  const selectedTreatmentIds = useMemo(
    () => new Set(addOn?.compatibleTreatmentIds ?? []),
    [addOn?.compatibleTreatmentIds],
  );

  const nameError = !name.trim() ? "Name is required." : null;
  const priceError =
    additionalPrice.trim() && !/^\d+(\.\d{1,2})?$/.test(additionalPrice.trim())
      ? "Use pounds and optional pennies, for example 5 or 5.50."
      : null;
  const durationError =
    additionalDuration.trim() &&
    (!Number.isInteger(Number(additionalDuration)) ||
      Number(additionalDuration) < 0)
      ? "Duration must be zero or more whole minutes."
      : null;
  const needsIncreaseError =
    Number(additionalPrice) === 0 && Number(additionalDuration) === 0
      ? "Add-ons must increase the price, duration or both."
      : null;
  const hasClientError = Boolean(
    nameError || priceError || durationError || needsIncreaseError,
  );
  const heading = mode === "create" ? "New add-on" : "Edit add-on";

  return (
    <main className="container max-w-md p-5">
      <div className="mt-6 flex flex-col">
        <FocusedTaskHeader
          backHref="/dashboard/add-ons"
          title={heading}
          formId="treatment_add_on_form"
          submitLabel={mode === "create" ? "Create" : "Save"}
          pendingLabel={mode === "create" ? "Creating..." : "Saving..."}
          pending={pending}
          disabled={hasClientError}
        />

        <form
          id="treatment_add_on_form"
          action={formAction}
          className="mt-8 flex flex-col gap-4"
        >
          {addOn ? (
            <input type="hidden" name="addOnId" value={addOn.addOnId} />
          ) : null}

          <FormField label="Name" htmlFor="name" error={nameError}>
            <input
              id="name"
              name="name"
              required
              className="field"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </FormField>

          <FormField
            label="Additional price"
            htmlFor="additional_price"
            error={priceError}
          >
            <input
              type="text"
              id="additional_price"
              name="additional_price"
              required
              inputMode="decimal"
              className="field"
              value={additionalPrice}
              onChange={(event) => setAdditionalPrice(event.target.value)}
            />
          </FormField>

          <FormField
            label="Additional duration"
            htmlFor="additional_duration_minutes"
            error={durationError}
          >
            <input
              type="number"
              id="additional_duration_minutes"
              name="additional_duration_minutes"
              required
              min="0"
              step="1"
              className="field"
              value={additionalDuration}
              onChange={(event) => setAdditionalDuration(event.target.value)}
            />
          </FormField>

          <fieldset className="field-set">
            <legend className="label">Compatible treatments</legend>
            <p className="text-sm text-black/60">
              Choose active treatments that can use this add-on.
            </p>
            <div className="mt-3 flex flex-col gap-2">
              {treatments.length === 0 ? (
                <p className="text-sm text-black/60">
                  No active treatments are available yet.
                </p>
              ) : (
                treatments.map((treatment) => (
                  <label
                    key={treatment.id}
                    className="flex items-center gap-2 text-sm"
                  >
                    <input
                      type="checkbox"
                      name="compatibleTreatmentIds"
                      value={treatment.id}
                      defaultChecked={selectedTreatmentIds.has(treatment.id)}
                      className="h-4 w-4"
                    />
                    <span>{treatment.name}</span>
                  </label>
                ))
              )}
            </div>
          </fieldset>

          <ErrorMessage message={needsIncreaseError} />
          {stateMessage ? (
            <p className="mt-4 text-sm text-red-600">{stateMessage}</p>
          ) : null}
        </form>

        {mode === "edit" ? (
          <div className="mt-8 flex items-center">
            <ArchiveButton
              addOn={addOn}
              archiveAction={archiveAction}
              restoreAction={restoreAction}
              pending={pending}
            />
          </div>
        ) : null}
      </div>
    </main>
  );
}
