"use client";

import { useActionState } from "react";
import { PendingButton } from "@/components/pending-button";
import { formatBlockedDate } from "../_lib/schedule-form";

export function BlockedDatesForm({ blockedDates, blockDate, removeBlockedDate }) {
  const [blockDateState, blockDateAction, blockDatePending] = useActionState(
    blockDate,
    { status: "idle" },
  );
  const [removeState, removeBlockedDateAction] = useActionState(
    removeBlockedDate,
    { status: "idle" },
  );
  const blockDateMessage =
    blockDateState.status === "error"
      ? blockDateState.message
      : blockDateState.status === "blocked"
        ? "Date blocked."
        : "";
  const removeMessage =
    removeState.status === "error" ? removeState.message : "";

  return (
    <section className="mt-12 flex flex-col gap-4">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">
          Blocked dates
        </h2>
        <p className="mt-1 text-sm text-black/60">
          Existing bookings are not cancelled.
        </p>
      </div>

      <form action={blockDateAction} className="flex items-end gap-3">
        <span className="field-set flex-1">
          <label className="label" htmlFor="local_date">
            Date
          </label>
          <input
            id="local_date"
            name="local_date"
            type="date"
            className="field"
          />
        </span>
        <button
          type="submit"
          disabled={blockDatePending}
          aria-disabled={blockDatePending}
          className="w-max rounded-lg bg-pink-700 p-3 px-4 text-sm font-semibold text-white shadow-sm duration-200 hover:bg-pink-800 disabled:cursor-not-allowed disabled:opacity-60 aria-disabled:cursor-not-allowed aria-disabled:opacity-50"
        >
          {blockDatePending ? "Blocking..." : "Block date"}
        </button>
      </form>

      {blockDateMessage ? (
        <p className="text-sm text-red-600">{blockDateMessage}</p>
      ) : null}

      {removeMessage ? (
        <p className="text-sm text-red-600">{removeMessage}</p>
      ) : null}

      {blockedDates.length ? (
        <ul className="flex flex-col gap-2">
          {blockedDates.map((blockedDate) => (
            <li
              key={blockedDate.id}
              className="flex items-center gap-3 rounded-lg border border-black/10 p-3"
            >
              <p className="flex-1 text-sm font-medium">
                {formatBlockedDate(blockedDate.local_date)}
              </p>
              <form action={removeBlockedDateAction}>
                <input
                  type="hidden"
                  name="blocked_date_id"
                  value={blockedDate.id}
                />
                <PendingButton
                  pendingLabel="Removing..."
                  className="rounded-lg border border-black/10 p-2 px-3 text-sm font-semibold text-pink-600 duration-200 hover:border-black/20 active:border-transparent active:bg-pink-500/10 active:text-pink-500 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Remove
                </PendingButton>
              </form>
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-lg border border-dashed border-black/15 p-4 text-sm text-black/60">
          No upcoming blocked dates.
        </p>
      )}
    </section>
  );
}
