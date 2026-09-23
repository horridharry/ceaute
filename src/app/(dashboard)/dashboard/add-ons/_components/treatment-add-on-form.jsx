"use client";

import { useActionState, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, OptionalMarker } from "@/components/ui/field";
import { FormActions } from "@/components/ui/form-actions";
import { FormError } from "@/components/ui/form-feedback";
import { Input } from "@/components/ui/input";
import { PageContainer } from "@/components/ui/page-container";
import { useFormUnsavedGuard } from "@/components/unsaved-changes/use-form-unsaved-guard";
import { SectionHeading } from "../../_components/section-heading";

// Archive, restore and delete live in the add-on list's menu, so the form
// only edits.
export function TreatmentAddOnForm({
  action,
  addOn,
  mode,
  treatments,
}) {
  const [stateMessage, formAction, pending] = useActionState(action, "");
  const { formProps } = useFormUnsavedGuard({ pending });
  const [name, setName] = useState(addOn?.name ?? "");
  const [additionalPrice, setAdditionalPrice] = useState(
    addOn ? String(addOn.additional_price) : "0",
  );
  const [additionalDuration, setAdditionalDuration] = useState(
    addOn ? String(addOn.additional_duration_minutes) : "0",
  );
  const [touchedIncrease, setTouchedIncrease] = useState(false);
  const [touchedName, setTouchedName] = useState(false);
  const selectedTreatmentIds = useMemo(
    () => new Set(addOn?.compatibleTreatmentIds ?? []),
    [addOn?.compatibleTreatmentIds],
  );
  const archivedLinks = addOn?.archivedLinkedTreatments ?? [];

  // Errors wait until the provider has typed; the submit stays disabled
  // until the form is valid, so an untouched form can't be sent incomplete.
  const nameMissing = !name.trim();
  const nameError = nameMissing && touchedName ? "Name is required." : null;
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
  const needsIncrease =
    Number(additionalPrice) === 0 && Number(additionalDuration) === 0;
  const hasClientError = Boolean(
    nameMissing || priceError || durationError || needsIncrease,
  );
  const isCreate = mode === "create";

  return (
    <PageContainer>
      <SectionHeading
        back={{ href: "/dashboard/add-ons", label: "Add-ons" }}
        title={isCreate ? "New add-on" : "Edit add-on"}
      />

      <form
        {...formProps}
        id="treatment_add_on_form"
        action={formAction}
        className="mt-8 flex flex-col gap-5"
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
              maxLength={100}
              value={name}
              onChange={(event) => {
                setTouchedName(true);
                setName(event.target.value);
              }}
              onBlur={() => setTouchedName(true)}
            />
          )}
        </Field>

        <div className="flex flex-col gap-1.5">
          <div className="grid grid-cols-2 gap-2.5">
            <Field label="Extra price" htmlFor="additional_price" error={priceError}>
              {(control) => (
                <span className="relative block">
                  <span
                    aria-hidden="true"
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-ink-muted"
                  >
                    £
                  </span>
                  <Input
                    {...control}
                    aria-describedby={[control["aria-describedby"], "add_on_increase"]
                      .filter(Boolean)
                      .join(" ")}
                    type="text"
                    name="additional_price"
                    required
                    inputMode="decimal"
                    className="w-full pl-7"
                    value={additionalPrice}
                    onChange={(event) => {
                      setTouchedIncrease(true);
                      setAdditionalPrice(event.target.value);
                    }}
                  />
                </span>
              )}
            </Field>

            <Field
              label="Extra time (minutes)"
              htmlFor="additional_duration_minutes"
              error={durationError}
            >
              {(control) => (
                <Input
                  {...control}
                  aria-describedby={[control["aria-describedby"], "add_on_increase"]
                    .filter(Boolean)
                    .join(" ")}
                  type="number"
                  name="additional_duration_minutes"
                  required
                  min="0"
                  step="1"
                  className="w-full"
                  value={additionalDuration}
                  onChange={(event) => {
                    setTouchedIncrease(true);
                    setAdditionalDuration(event.target.value);
                  }}
                />
              )}
            </Field>
          </div>
          <p
            id="add_on_increase"
            className={`text-sm ${needsIncrease && touchedIncrease ? "text-danger" : "text-ink-muted"}`}
          >
            An add-on must add to the price, the time or both.
          </p>
        </div>

        {/* An add-on may be saved with no compatible treatments (the
            database accepts an empty list), so this group is optional. */}
        <fieldset className="flex flex-col gap-1.5" aria-describedby="compatible_treatments_hint">
          <legend className="label">
            Works with
            <OptionalMarker />
          </legend>
          <p id="compatible_treatments_hint" className="text-sm text-ink-muted">
            {archivedLinks.length
              ? "Choose active treatments that can use this add-on. Links to archived treatments are kept when you save; restore the treatment to use them again."
              : "Choose active treatments that can use this add-on."}
          </p>
          <div className="mt-1 flex flex-col">
            {treatments.length === 0 && archivedLinks.length === 0 ? (
              <p className="text-sm text-ink-muted">
                No active treatments are available yet.
              </p>
            ) : null}
            {treatments.map((treatment) => (
              <label
                key={treatment.id}
                className="flex min-h-11 cursor-pointer items-center gap-3 text-sm"
              >
                <Checkbox
                  name="compatibleTreatmentIds"
                  value={treatment.id}
                  defaultChecked={selectedTreatmentIds.has(treatment.id)}
                />
                <span>{treatment.name}</span>
              </label>
            ))}
            {archivedLinks.map((treatment) => (
              <label
                key={treatment.id}
                className="flex min-h-11 items-center gap-3 text-sm text-ink-muted"
              >
                <Checkbox checked readOnly disabled />
                <span>
                  {treatment.name} <span className="text-ink-subtle">(archived treatment)</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <FormError>{stateMessage}</FormError>
        <FormActions discardHref="/dashboard/add-ons">
          <Button
            type="submit"
            disabled={pending || hasClientError}
            aria-busy={pending || undefined}
          >
            {pending ? (isCreate ? "Adding…" : "Saving…") : isCreate ? "Add add-on" : "Save"}
          </Button>
        </FormActions>
      </form>

    </PageContainer>
  );
}
