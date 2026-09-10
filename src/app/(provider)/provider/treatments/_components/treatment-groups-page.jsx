"use client";

import Link from "next/link";
import { useActionState } from "react";

function ActionMessage({ message }) {
  return message ? <p className="mt-2 text-sm text-black/60">{message}</p> : null;
}

function CreateGroupForm({ action }) {
  const [message, formAction, pending] = useActionState(action, "");

  return (
    <form action={formAction} className="mt-10 flex flex-col gap-3">
      <label htmlFor="new_group_name" className="label">
        New group name
      </label>
      <input
        id="new_group_name"
        name="name"
        required
        className="field"
        placeholder="Nail treatments"
      />
      <button
        type="submit"
        disabled={pending}
        aria-disabled={pending}
        className="w-max rounded-lg bg-pink-700 p-3 px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60 aria-disabled:cursor-not-allowed aria-disabled:opacity-60"
      >
        {pending ? "Creating..." : "Create group"}
      </button>
      <ActionMessage message={message} />
    </form>
  );
}

function RenameGroupForm({ group, action }) {
  const [message, formAction, pending] = useActionState(action, "");

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <input type="hidden" name="group_id" value={group.id} />
      <label htmlFor={`group_name_${group.id}`} className="sr-only">
        Rename {group.name}
      </label>
      <input
        id={`group_name_${group.id}`}
        name="name"
        required
        className="field"
        defaultValue={group.name}
      />
      <button
        type="submit"
        disabled={pending}
        aria-disabled={pending}
        className="w-max rounded-lg border border-black/10 p-3 px-4 text-sm font-semibold text-pink-600 duration-200 hover:border-black/20 active:border-transparent active:bg-pink-500/10 active:text-pink-500 disabled:cursor-not-allowed disabled:opacity-60 aria-disabled:cursor-not-allowed aria-disabled:opacity-50"
      >
        {pending ? "Saving..." : "Rename"}
      </button>
      <ActionMessage message={message} />
    </form>
  );
}

function GroupStateForm({ group, archiveAction, restoreAction }) {
  const action = group.is_active ? archiveAction : restoreAction;
  const [message, formAction, pending] = useActionState(action, "");

  return (
    <form action={formAction} className="flex flex-col items-start gap-2">
      <input type="hidden" name="group_id" value={group.id} />
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
  renameAction,
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
              <div className="flex flex-col gap-4">
                <div>
                  <p className="text-sm text-black/60">
                    {group.referenced_treatment_count === 1
                      ? "1 treatment"
                      : `${group.referenced_treatment_count} treatments`}
                  </p>
                </div>
                <RenameGroupForm group={group} action={renameAction} />
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
  createAction,
  renameAction,
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
          <Link
            href="/provider/treatments"
            className="w-max rounded-lg border border-black/10 p-3 px-4 text-sm font-semibold text-pink-600 duration-200 hover:border-black/20 active:border-transparent active:bg-pink-500/10 active:text-pink-500"
          >
            Back
          </Link>
        </div>

        <CreateGroupForm action={createAction} />

        <GroupList
          title="Active groups"
          emptyMessage="No active groups yet."
          groups={activeGroups}
          renameAction={renameAction}
          archiveAction={archiveAction}
          restoreAction={restoreAction}
        />

        <GroupList
          title="Archived groups"
          emptyMessage="No archived groups."
          groups={archivedGroups}
          renameAction={renameAction}
          archiveAction={archiveAction}
          restoreAction={restoreAction}
        />
      </div>
    </main>
  );
}
