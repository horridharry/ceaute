"use client";

import Link from "next/link";
import { StackedTopBar } from "@/components/ui/top-bar";
import { useActionState, useMemo, useState } from "react";

function ErrorMessage({ message }) {
  return message ? <p className="text-sm text-bad">{message}</p> : null;
}

function SubmitButton({ pending, mode, hasClientError, formId }) {
  const idleLabel = mode === "create" ? "Create treatment" : "Save treatment";
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

function ArchiveButton({ treatment, archiveAction, restoreAction, pending }) {
  const [archiveMessage, formAction, archivePending] = useActionState(
    treatment.is_active ? archiveAction : restoreAction,
    "",
  );
  const isPending = pending || archivePending;
  const isArchived = !treatment.is_active;

  return (
    <form action={formAction} className="mr-auto">
      <input type="hidden" name="treatmentId" value={treatment.treatmentId} />
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
      {archiveMessage ? (
        <p className="mt-2 text-sm text-bad">{archiveMessage}</p>
      ) : null}
    </form>
  );
}

export function TreatmentForm({
  action,
  archiveAction,
  restoreAction,
  discoveryCategories,
  treatmentGroups,
  mode,
  treatment,
}) {
  const [stateMessage, formAction, pending] = useActionState(action, "");
  const [name, setName] = useState(treatment?.name ?? "");
  const [description, setDescription] = useState(treatment?.description ?? "");
  const [price, setPrice] = useState(
    treatment?.price ? String(treatment.price) : "",
  );
  const [durationMinutes, setDurationMinutes] = useState(
    treatment?.duration_minutes ? String(treatment.duration_minutes) : "",
  );

  const nameError =
    name.trim() && name.trim().length < 2
      ? "Name must be at least 2 characters."
      : null;
  const priceError =
    price.trim() && !/^\d+(\.\d{1,2})?$/.test(price.trim())
      ? "Use pounds and optional pennies, for example 35 or 35.50."
      : null;
  const durationError =
    durationMinutes.trim() &&
    (!Number.isInteger(Number(durationMinutes)) || Number(durationMinutes) <= 0)
      ? "Duration must be a whole number of minutes greater than zero."
      : null;
  const hasClientError = Boolean(nameError || priceError || durationError);
  const heading = mode === "create" ? "Create treatment" : "Edit treatment";
  const fallbackCategoryId = useMemo(
    () => treatment?.discovery_category_id || discoveryCategories[0]?.id || "",
    [discoveryCategories, treatment?.discovery_category_id],
  );

  return (
    <>
      <div className="mx-auto w-full max-w-[720px] px-5">
        <StackedTopBar backHref="/dashboard/treatments" backLabel="Treatments" />
      </div>
      <main className="mx-auto w-full max-w-[720px] px-5 pb-8">
      <div className="mt-6 flex flex-col">
        <h1 className="text-display text-pretty text-ink">{heading}</h1>

        <form
          id="treatment_form"
          className="mt-12 flex flex-col gap-4"
          action={formAction}
        >
          {treatment ? (
            <input
              type="hidden"
              name="treatmentId"
              value={treatment.treatmentId}
            />
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
            <label htmlFor="description" className="label">
              Description
            </label>
            <textarea
              id="description"
              name="description"
              required
              className="field"
              rows={3}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </span>

          <span className="field-set">
            <label htmlFor="price" className="label">
              Price
            </label>
            <ErrorMessage message={priceError} />
            <input
              type="text"
              id="price"
              name="price"
              required
              inputMode="decimal"
              placeholder="35.00"
              className="field"
              value={price}
              onChange={(event) => setPrice(event.target.value)}
            />
          </span>

          <span className="field-set">
            <label htmlFor="duration_minutes" className="label">
              Duration
            </label>
            <ErrorMessage message={durationError} />
            <input
              type="number"
              id="duration_minutes"
              name="duration_minutes"
              required
              min="1"
              step="1"
              placeholder="60"
              className="field"
              value={durationMinutes}
              onChange={(event) => setDurationMinutes(event.target.value)}
            />
          </span>

          <span className="field-set">
            <label htmlFor="discovery_category_id" className="label">
              Discovery category
            </label>
            <select
              id="discovery_category_id"
              name="discovery_category_id"
              required
              className="field cursor-pointer"
              defaultValue={fallbackCategoryId}
            >
              {discoveryCategories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </span>

          <span className="field-set">
            <label htmlFor="treatment_group_id" className="label">
              Treatment group
            </label>
            <select
              id="treatment_group_id"
              name="treatment_group_id"
              className="field cursor-pointer"
              defaultValue={treatment?.treatment_group_id ?? ""}
            >
              <option value="">No group</option>
              {treatmentGroups.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.name}
                </option>
              ))}
            </select>
          </span>

          {stateMessage ? (
            <p className="mt-4 text-sm text-bad">{stateMessage}</p>
          ) : null}
        </form>
        <div className="mt-8 flex items-center gap-2">
          {mode === "edit" ? (
            <ArchiveButton
              treatment={treatment}
              archiveAction={archiveAction}
              restoreAction={restoreAction}
              pending={pending}
            />
          ) : null}
          <Link
            href="/dashboard/treatments"
            className="inline-flex h-12 select-none items-center justify-center rounded-control border border-black/16 px-6 text-body-strong text-ink transition duration-150 ease-out hover:border-black/30"
          >
            Back
          </Link>
          <SubmitButton
            formId="treatment_form"
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
