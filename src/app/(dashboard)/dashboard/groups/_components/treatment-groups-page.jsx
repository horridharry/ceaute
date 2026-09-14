"use client";

import Link from "next/link";
import { useActionState } from "react";

function ActionMessage({ message }) {
  return message ? <p className="mt-2 text-sm text-black/60">{message}</p> : null;
}

function GroupStateForm({ group, archiveAction, restoreAction }) {
  const action = group.is_active ? archiveAction : restoreAction;
  const [message, formAction, pending] = useActionState(action, "");

  return (
    <form action={formAction} className="flex flex-col items-start gap-2">
      <input type="hidden" name="groupId" value={group.id} />
      <button
        type="submit"
        disabled={pending}
        aria-disabled={pending}
        className="w-max rounded-lg p-3 px-4 text-sm font-semibold text-rose-600 duration-200 hover:border-transparent hover:bg-rose-50/80 active:bg-rose-600 active:text-white disabled:cursor-not-allowed disabled:opacity-60 aria-disabled:cursor-not-allowed aria-disabled:opacity-60"
      >
        {pending
          ? group.is_active
            ? "Archiving..."
            : "Restoring..."
          : group.is_active
            ? "Archive"
            : "Restore"}
      </button>
      <ActionMessage message={message} />
    </form>
  );
}

function GroupList({
  title,
  emptyMessage,
  groups,
  archiveAction,
  restoreAction,
}) {
  return (
    <section className="mt-10">
      <h2 className="text-lg font-semibold">{title}</h2>
      {groups.length === 0 ? (
        <p className="mt-3 text-sm text-black/60">{emptyMessage}</p>
      ) : (
        <ul className="mt-4 flex flex-col gap-4">
          {groups.map((group) => (
            <li key={group.id} className="list-none rounded-xl border p-3">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="font-medium">{group.name}</h3>
                  <p className="mt-1 text-sm text-black/60">
                    {group.referenced_treatment_count === 1
                      ? "1 treatment"
                      : `${group.referenced_treatment_count} treatments`}
                  </p>
                </div>
                <Link
                  href={`/dashboard/groups/${group.id}/edit`}
                  className="w-max rounded-lg border border-black/10 p-3 px-4 text-sm font-semibold text-pink-600 duration-200 hover:border-black/20"
                >
                  Edit
                </Link>
              </div>
              <div className="mt-4">
                <GroupStateForm
                  group={group}
                  archiveAction={archiveAction}
                  restoreAction={restoreAction}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function TreatmentGroupsPage({
  groups,
  archiveAction,
  restoreAction,
}) {
  const activeGroups = groups.filter((group) => group.is_active);
  const archivedGroups = groups.filter((group) => !group.is_active);

  return (
    <main className="container max-w-md p-5">
      <div className="mt-6 flex flex-col">
        <div className="flex items-end justify-between gap-4">
          <h1 className="text-3xl font-bold tracking-tighter">
            Treatment groups
          </h1>
          <div className="flex items-center gap-2">
            <Link
              href="/dashboard/treatments"
              className="w-max rounded-lg border border-black/10 p-3 px-4 text-sm font-semibold text-pink-600 duration-200 hover:border-black/20"
            >
              Back
            </Link>
            <Link
              href="/dashboard/groups/new"
              className="flex w-max items-center rounded-3xl bg-white p-1.5 px-3 text-sm font-semibold text-pink-600 duration-300 hover:bg-pink-500/10"
            >
              Create
            </Link>
          </div>
        </div>

        <GroupList
          title="Active groups"
          emptyMessage="No active groups yet."
          groups={activeGroups}
          archiveAction={archiveAction}
          restoreAction={restoreAction}
        />

        <GroupList
          title="Archived groups"
          emptyMessage="No archived groups."
          groups={archivedGroups}
          archiveAction={archiveAction}
          restoreAction={restoreAction}
        />
      </div>
    </main>
  );
}
