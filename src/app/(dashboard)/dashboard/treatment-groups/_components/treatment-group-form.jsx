"use client";

import Link from "next/link";
import { useActionState } from "react";
import { PendingButton } from "@/components/pending-button";
import { FocusedTaskHeader } from "../../_components/focused-task-header";

export function TreatmentGroupForm({ action, group = null }) {
  const [message, formAction] = useActionState(action, "");
  const editing = Boolean(group);

  return (
    <main className="container max-w-md p-5">
      <div className="mt-6 flex flex-col">
        <FocusedTaskHeader
          backHref="/dashboard/treatment-groups"
          backLabel="Groups"
          title={editing ? "Edit group" : "New group"}
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
          <PendingButton
            pendingLabel={editing ? "Saving..." : "Creating..."}
            className="mt-1 w-full rounded-[11px] bg-accent-600 py-3.5 text-sm font-medium text-white disabled:opacity-40"
          >
            {editing ? "Save" : "Create"}
          </PendingButton>
          <Link
            href="/dashboard/treatment-groups"
            className="block py-1 text-center text-sm font-medium text-black/50"
          >
            Discard
          </Link>
        </form>
      </div>
    </main>
  );
}
