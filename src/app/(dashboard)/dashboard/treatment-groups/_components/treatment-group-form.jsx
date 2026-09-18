"use client";

import Link from "next/link";
import { useActionState } from "react";

export function TreatmentGroupForm({ action, group = null }) {
  const [message, formAction, pending] = useActionState(action, "");
  const editing = Boolean(group);

  return (
    <main className="container max-w-md p-5">
      <div className="mt-6 flex flex-col">
        <h1 className="text-3xl font-bold tracking-tighter">
          {editing ? "Edit treatment group" : "New treatment group"}
        </h1>
        <form action={formAction} className="mt-10 flex flex-col gap-3">
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
          <p className="text-sm text-black/60">{message}</p>
          <div className="mt-4 flex items-center justify-end gap-2">
            <Link
              href="/dashboard/treatment-groups"
              className="w-max rounded-lg border border-black/10 p-3 px-6 text-sm font-semibold text-plum duration-200 hover:border-black/20"
            >
              Back
            </Link>
            <button
              type="submit"
              disabled={pending}
              aria-disabled={pending}
              className="w-max rounded-lg bg-plum p-3 px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {pending
                ? editing
                  ? "Saving..."
                  : "Creating..."
                : editing
                  ? "Save"
                  : "Create group"}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
