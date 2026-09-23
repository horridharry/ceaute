"use client";

import { useActionState, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { FormActions } from "@/components/ui/form-actions";
import { FormError } from "@/components/ui/form-feedback";
import { Input } from "@/components/ui/input";
import { PageContainer } from "@/components/ui/page-container";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { FocusedTaskHeader } from "../../_components/focused-task-header";

// Archive and Restore for a treatment stay on its edit screen, unchanged in
// behaviour; they sit in their own section after the form.
function ArchiveSection({ treatment, archiveAction, restoreAction, pending }) {
  const isArchived = !treatment.is_active;
  const [message, formAction, archivePending] = useActionState(
    isArchived ? restoreAction : archiveAction,
    "",
  );

  return (
    <section aria-labelledby="archive-treatment" className="mt-10 border-t border-line pt-5">
      <h2 id="archive-treatment" className="text-sm font-semibold">
        {isArchived ? "Restore treatment" : "Archive treatment"}
      </h2>
      <p className="mt-1 text-sm text-ink-muted">
        {isArchived
          ? "Shows it on your page again."
          : "Hidden from your page and new bookings. You can restore it later."}
      </p>
      <form action={formAction} className="mt-2">
        <input type="hidden" name="treatmentId" value={treatment.treatmentId} />
        <Button
          type="submit"
          variant={isArchived ? "secondary" : "destructive"}
          className={isArchived ? "" : "-ml-4"}
          disabled={pending || archivePending}
          aria-busy={archivePending || undefined}
        >
          {archivePending
            ? isArchived
              ? "Restoring…"
              : "Archiving…"
            : isArchived
              ? "Restore"
              : "Archive"}
        </Button>
        <FormError className="mt-2">{message}</FormError>
      </form>
    </section>
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
  const [price, setPrice] = useState(treatment?.price ? String(treatment.price) : "");
  const [durationMinutes, setDurationMinutes] = useState(
    treatment?.duration_minutes ? String(treatment.duration_minutes) : "",
  );

  const nameError =
    name.trim() && name.trim().length < 2 ? "Name must be at least 2 characters." : "";
  const priceError =
    price.trim() && !/^\d+(\.\d{1,2})?$/.test(price.trim())
      ? "Use pounds and optional pennies, for example 35 or 35.50."
      : price.trim() && Number(price.trim()) < 1
        ? "A treatment costs at least £1.00."
        : "";
  const durationError =
    durationMinutes.trim() &&
    (!Number.isInteger(Number(durationMinutes)) || Number(durationMinutes) <= 0)
      ? "Duration must be a whole number of minutes greater than zero."
      : "";
  const hasClientError = Boolean(nameError || priceError || durationError);
  const isCreate = mode === "create";
  const archivedGroup = treatment?.archived_group ?? null;
  const fallbackCategoryId = useMemo(
    () => treatment?.discovery_category_id || discoveryCategories[0]?.id || "",
    [discoveryCategories, treatment?.discovery_category_id],
  );

  return (
    <PageContainer>
      <FocusedTaskHeader
        backHref="/dashboard/treatments"
        title={isCreate ? "New treatment" : "Edit treatment"}
      />

      <form id="treatment_form" className="mt-8 flex flex-col gap-5" action={formAction}>
        {treatment ? (
          <input type="hidden" name="treatmentId" value={treatment.treatmentId} />
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

        <Field label="Description" optional htmlFor="description">
          {(control) => (
            <Textarea
              {...control}
              name="description"
              rows={4}
              className="resize-none"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          )}
        </Field>

        <div className="grid grid-cols-2 gap-2.5">
          <Field label="Price" htmlFor="price" error={priceError}>
            {(control) => (
              <span className="relative block">
                <span aria-hidden="true" className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-ink-muted">
                  £
                </span>
                <Input
                  {...control}
                  type="text"
                  name="price"
                  required
                  inputMode="decimal"
                  placeholder="35.00"
                  className="w-full pl-7"
                  value={price}
                  onChange={(event) => setPrice(event.target.value)}
                />
              </span>
            )}
          </Field>
          <Field label="Duration (minutes)" htmlFor="duration_minutes" error={durationError}>
            {(control) => (
              <Input
                {...control}
                type="number"
                name="duration_minutes"
                required
                min="1"
                step="1"
                placeholder="60"
                className="w-full"
                value={durationMinutes}
                onChange={(event) => setDurationMinutes(event.target.value)}
              />
            )}
          </Field>
        </div>

        <Field
          label="Treatment group"
          htmlFor="treatment_group_id"
          hint={
            archivedGroup
              ? "This group is archived. Choose another group or No group to move the treatment out."
              : ""
          }
        >
          {(control) => (
            <Select
              {...control}
              name="treatment_group_id"
              defaultValue={treatment?.treatment_group_id ?? ""}
            >
              {treatmentGroups
                .filter((group) => group.id !== archivedGroup?.id)
                .map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.name}
                  </option>
                ))}
              {archivedGroup ? (
                <option value={archivedGroup.id}>{archivedGroup.name} (archived)</option>
              ) : null}
              <option value="">No group</option>
            </Select>
          )}
        </Field>

        <Field
          label="Ceaute category"
          htmlFor="discovery_category_id"
          hint="Helps customers find you in Discover."
        >
          {(control) => (
            <Select
              {...control}
              name="discovery_category_id"
              required
              defaultValue={fallbackCategoryId}
            >
              {discoveryCategories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </Select>
          )}
        </Field>

        <FormError>{stateMessage}</FormError>
        <FormActions>
          <Button type="submit" disabled={pending || hasClientError} aria-busy={pending || undefined}>
            {pending ? (isCreate ? "Adding…" : "Saving…") : isCreate ? "Add treatment" : "Save"}
          </Button>
        </FormActions>
      </form>

      {!isCreate ? (
        <ArchiveSection
          treatment={treatment}
          archiveAction={archiveAction}
          restoreAction={restoreAction}
          pending={pending}
        />
      ) : null}
    </PageContainer>
  );
}
