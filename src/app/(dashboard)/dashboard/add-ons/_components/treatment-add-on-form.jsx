"use client";

import { useActionState, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, OptionalMarker } from "@/components/ui/field";
import { FormError } from "@/components/ui/form-feedback";
import { Input } from "@/components/ui/input";
import { PageContainer } from "@/components/ui/page-container";
import { FocusedTaskHeader } from "../../_components/focused-task-header";

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
      <Button
        type="submit"
        variant="destructive"
        className="w-max"
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
      </Button>
      <FormError className="mt-2">{message}</FormError>
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
    <PageContainer>
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

          <Field label="Name" htmlFor="name" error={nameError}>
            {(control) => (
              <Input
                {...control}
                name="name"
                required
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            )}
          </Field>

          <Field
            label="Additional price"
            htmlFor="additional_price"
            error={priceError}
          >
            {(control) => (
              <Input
                {...control}
                type="text"
                name="additional_price"
                required
                inputMode="decimal"
                value={additionalPrice}
                onChange={(event) => setAdditionalPrice(event.target.value)}
              />
            )}
          </Field>

          <Field
            label="Additional duration"
            htmlFor="additional_duration_minutes"
            error={durationError}
          >
            {(control) => (
              <Input
                {...control}
                type="number"
                name="additional_duration_minutes"
                required
                min="0"
                step="1"
                value={additionalDuration}
                onChange={(event) => setAdditionalDuration(event.target.value)}
              />
            )}
          </Field>

          {/* An add-on may be saved with no compatible treatments (the
              database accepts an empty list), so this group is optional. */}
          <fieldset
            className="field-set"
            aria-describedby="compatible_treatments_hint"
          >
            <legend className="label">
              Compatible treatments
              <OptionalMarker />
            </legend>
            <p id="compatible_treatments_hint" className="text-sm text-ink-muted">
              Choose active treatments that can use this add-on.
            </p>
            <div className="mt-3 flex flex-col gap-2">
              {treatments.length === 0 ? (
                <p className="text-sm text-ink-muted">
                  No active treatments are available yet.
                </p>
              ) : (
                treatments.map((treatment) => (
                  <label
                    key={treatment.id}
                    className="flex items-center gap-2 text-sm"
                  >
                    <Checkbox
                      name="compatibleTreatmentIds"
                      value={treatment.id}
                      defaultChecked={selectedTreatmentIds.has(treatment.id)}
                    />
                    <span>{treatment.name}</span>
                  </label>
                ))
              )}
            </div>
          </fieldset>

          <FormError>{needsIncreaseError}</FormError>
          <FormError className="mt-4">{stateMessage}</FormError>
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
    </PageContainer>
  );
}
