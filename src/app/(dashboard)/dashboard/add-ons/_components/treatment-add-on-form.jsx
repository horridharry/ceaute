"use client";

import Link from "next/link";
import { StackedTopBar } from "@/components/ui/top-bar";
import { useActionState, useMemo, useState } from "react";

function ErrorMessage({ message }) {
  return message ? <p className="text-sm text-bad">{message}</p> : null;
}

function SubmitButton({ pending, mode, hasClientError, formId }) {
  const idleLabel = mode === "create" ? "Create add-on" : "Save add-on";
  const pendingLabel = mode === "create" ? "Creating..." : "Saving...";

  return (
    <button
      type="submit"
      form={formId}
      disabled={pending || hasClientError}
      aria-disabled={pending || hasClientError}
      className="inline-flex h-12 select-none items-center justify-center rounded-control bg-plum px-6 text-body-strong font-semibold text-white transition duration-150 ease-out hover:bg-plum-hover disabled:pointer-events-none disabled:opacity-40 aria-disabled:pointer-events-none aria-disabled:opacity-40"
    >
      {pending ? pendingLabel : idleLabel}
    </button>
  );
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
        className="w-max rounded-lg p-3 px-6 text-sm font-semibold text-bad duration-200 hover:border-transparent hover:bg-bad/5 active:bg-bad active:text-white disabled:cursor-not-allowed disabled:opacity-60 aria-disabled:cursor-not-allowed aria-disabled:opacity-60"
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
      {message ? <p className="mt-2 text-sm text-bad">{message}</p> : null}
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
  const heading = mode === "create" ? "Create add-on" : "Edit add-on";

  return (
    <>
      <div className="mx-auto w-full max-w-[720px] px-5">
        <StackedTopBar backHref="/dashboard/add-ons" backLabel="Add-ons" />
      </div>
      <main className="mx-auto w-full max-w-[720px] px-5 pb-8">
      <div className="mt-6 flex flex-col">
        <h1 className="text-display text-pretty text-ink">{heading}</h1>

        <form
          id="treatment_add_on_form"
          action={formAction}
          className="mt-12 flex flex-col gap-4"
        >
          {addOn ? (
            <input type="hidden" name="addOnId" value={addOn.addOnId} />
          ) : null}

          <span className="field-set">
            <label htmlFor="name" className="label">
              Name
            </label>
            <ErrorMessage message={nameError} />
            <input
              id="name"
              name="name"
              required
              className="field"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </span>

          <span className="field-set">
            <label htmlFor="additional_price" className="label">
              Additional price
            </label>
            <ErrorMessage message={priceError} />
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
          </span>

          <span className="field-set">
            <label htmlFor="additional_duration_minutes" className="label">
              Additional duration
            </label>
            <ErrorMessage message={durationError} />
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
          </span>

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
            <p className="mt-4 text-sm text-bad">{stateMessage}</p>
          ) : null}
        </form>

        <div className="mt-8 flex items-center gap-2">
          {mode === "edit" ? (
            <ArchiveButton
              addOn={addOn}
              archiveAction={archiveAction}
              restoreAction={restoreAction}
              pending={pending}
            />
          ) : null}
          <Link
            href="/dashboard/add-ons"
            className="inline-flex h-12 select-none items-center justify-center rounded-control border border-black/16 px-6 text-body-strong text-ink transition duration-150 ease-out hover:border-black/30"
          >
            Back
          </Link>
          <SubmitButton
            formId="treatment_add_on_form"
            pending={pending}
            mode={mode}
            hasClientError={hasClientError}
          />
        </div>
      </div>
      </main>
    </>
  );
}
