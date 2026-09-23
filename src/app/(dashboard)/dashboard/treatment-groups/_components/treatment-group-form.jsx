"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { FormActions } from "@/components/ui/form-actions";
import { Input } from "@/components/ui/input";
import { PageContainer } from "@/components/ui/page-container";
import { FocusedTaskHeader } from "../../_components/focused-task-header";

// The name is the form's only field, so a refusal from the server (a name
// already in use, a blank name) is shown as that field's error. The value is
// controlled so it survives React resetting the form after the action.
export function TreatmentGroupForm({ action, group = null }) {
  const [message, formAction, pending] = useActionState(action, "");
  const [name, setName] = useState(group?.name ?? "");
  const inputRef = useRef(null);
  const editing = Boolean(group);

  useEffect(() => {
    if (message) inputRef.current?.focus();
  }, [message]);

  return (
    <PageContainer>
      <FocusedTaskHeader
        backHref="/dashboard/treatment-groups"
        title={editing ? "Rename group" : "New group"}
      />
      <form id="treatment_group_form" action={formAction} className="mt-8 flex flex-col gap-5">
        {editing ? <input type="hidden" name="groupId" value={group.id} /> : null}
        <Field
          label="Group name"
          htmlFor="group_name"
          hint="For example: Manicures, Extensions."
          error={message}
        >
          {(control) => (
            <Input
              {...control}
              ref={inputRef}
              name="name"
              required
              maxLength={100}
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          )}
        </Field>
        <FormActions>
          <Button type="submit" disabled={pending} aria-busy={pending || undefined}>
            {pending ? (editing ? "Saving…" : "Adding…") : editing ? "Save" : "Add group"}
          </Button>
        </FormActions>
      </form>
    </PageContainer>
  );
}
