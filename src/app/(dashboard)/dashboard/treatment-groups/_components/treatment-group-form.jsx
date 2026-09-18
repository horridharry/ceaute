"use client";

import Link from "next/link";
import { StackedTopBar } from "@/components/ui/top-bar";
import { useActionState } from "react";

export function TreatmentGroupForm({ action, group = null }) {
  const [message, formAction, pending] = useActionState(action, "");
  const editing = Boolean(group);

  return (
    <>
      <div className="mx-auto w-full max-w-[720px] px-5">
        <StackedTopBar backHref="/dashboard/treatment-groups" backLabel="Groups" />
      </div>
      <main className="mx-auto w-full max-w-[720px] px-5 pb-8">
      <div className="mt-6 flex flex-col">
        <h1 className="text-display text-pretty text-ink">
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
              className="inline-flex h-12 select-none items-center justify-center rounded-control border border-black/16 px-6 text-body-strong text-ink transition duration-150 ease-out hover:border-black/30"
            >
              Back
            </Link>
            <button
              type="submit"
              disabled={pending}
              aria-disabled={pending}
              className="inline-flex h-12 select-none items-center justify-center rounded-control bg-plum px-6 text-body-strong font-semibold text-white transition duration-150 ease-out hover:bg-plum-hover disabled:pointer-events-none disabled:opacity-40 aria-disabled:pointer-events-none aria-disabled:opacity-40"
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
    </>
  );
}
