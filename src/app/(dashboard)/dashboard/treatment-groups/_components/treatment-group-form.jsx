"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { FormActions } from "@/components/ui/form-actions";
import { FormError } from "@/components/ui/form-feedback";
import { Input } from "@/components/ui/input";
import { PageContainer } from "@/components/ui/page-container";
import { FocusedTaskHeader } from "../../_components/focused-task-header";

export function TreatmentGroupForm({ action, group = null }) {
  const [message, formAction, pending] = useActionState(action, "");
  const editing = Boolean(group);

  return (
    <PageContainer>
      <FocusedTaskHeader
        backHref="/dashboard/treatment-groups"
        title={editing ? "Rename group" : "New group"}
      />
      <form id="treatment_group_form" action={formAction} className="mt-8 flex flex-col gap-5">
        {editing ? <input type="hidden" name="groupId" value={group.id} /> : null}
        <Field label="Group name" htmlFor="group_name" hint="For example: Manicures, Extensions.">
          {(control) => (
            <Input
              {...control}
              name="name"
              required
              maxLength={100}
              defaultValue={group?.name ?? ""}
            />
          )}
        </Field>
        <FormError>{message}</FormError>
        <FormActions>
          <Button type="submit" disabled={pending} aria-busy={pending || undefined}>
            {pending ? (editing ? "Saving…" : "Adding…") : editing ? "Save" : "Add group"}
          </Button>
        </FormActions>
      </form>
    </PageContainer>
  );
}
