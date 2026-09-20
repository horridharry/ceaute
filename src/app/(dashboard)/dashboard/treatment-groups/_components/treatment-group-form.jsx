"use client";

import { useActionState } from "react";
import { FocusedTaskHeader } from "../../_components/focused-task-header";

export function TreatmentGroupForm({ action, group = null }) {
  const [message, formAction, pending] = useActionState(action, "");
  const editing = Boolean(group);

  return (
    <main className="container max-w-md p-5">
      <div className="mt-6 flex flex-col">
        <FocusedTaskHeader
          backHref="/dashboard/treatment-groups"
          title={editing ? "Edit group" : "New group"}
          formId="treatment_group_form"
          submitLabel={editing ? "Save" : "Create"}
          pendingLabel={editing ? "Saving..." : "Creating..."}
          pending={pending}
        />
        <form
          id="treatment_group_form"
          action={formAction}
          className="mt-8 flex flex-col gap-3"
        >
          {editing ? (
            <input type="hidden" name="groupId" value={group.id} />
          ) : null}
          <label htmlFor="group_name" className="label">
            Group name
          </label>
          <input
            id="group_name"
            name="name"
            required
            className="field"
            placeholder="Nail treatments"
            defaultValue={group?.name ?? ""}
          />
          {message ? <p className="text-sm text-black/60">{message}</p> : null}
        </form>
      </div>
    </main>
  );
}
