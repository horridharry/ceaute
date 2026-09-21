"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { PendingButton } from "@/components/ui/pending-button";
import {
  formatBlockedDateBookingsLine,
  toBookingCountsByDate,
} from "../_lib/booking-messages";
import {
  formatBlockedDate,
  formatClosedAnyway,
  isBlockedDateOnClosedWeekday,
  scheduleToState,
} from "../_lib/schedule-form";
import { BlockDatePanel } from "./block-date-panel";

// The Blocked dates section. Adding and removing take effect immediately and
// never touch the weekly-hours draft.
export function BlockedDatesForm({
  blockedDates,
  blockDate,
  removeBlockedDate,
  bookingCountRows,
  today,
  schedule,
}) {
  const [panelOpen, setPanelOpen] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  // { target: "block" } or { target: "neighbour", nextId, previousId }; a new
  // object each time so the effect below runs for every request.
  const [focusRequest, setFocusRequest] = useState(null);
  const sectionRef = useRef(null);
  const blockButtonRef = useRef(null);
  const blockedDatesRef = useRef(blockedDates);
  const countsByDate = useMemo(
    () => toBookingCountsByDate(bookingCountRows),
    [bookingCountRows],
  );
  const days = useMemo(() => scheduleToState(schedule), [schedule]);

  useEffect(() => {
    blockedDatesRef.current = blockedDates;
  }, [blockedDates]);

  const [, removeAction] = useActionState(async (currentState, formData) => {
    const blockedDateId = String(formData.get("blocked_date_id") ?? "");
    const rows = blockedDatesRef.current;
    const index = rows.findIndex((row) => row.id === blockedDateId);
    const submittedDate = index >= 0 ? rows[index].local_date : null;
    const nextId = index >= 0 ? rows[index + 1]?.id ?? null : null;
    const previousId = index > 0 ? rows[index - 1].id : null;
    const result = await removeBlockedDate(currentState, formData);

    if (result?.status === "removed") {
      const localDate = result.localDate ?? submittedDate;

      setStatusMessage(
        localDate
          ? `Unblocked ${formatBlockedDate(String(localDate).slice(0, 10), today)}`
          : "Unblocked",
      );
      setFocusRequest({ target: "neighbour", nextId, previousId });
    } else if (result?.status === "error") {
      setStatusMessage(result.message);
    }

    return result;
  }, { status: "idle" });

  useEffect(() => {
    if (!focusRequest) {
      return;
    }

    const findRemoveButton = (id) =>
      id
        ? sectionRef.current?.querySelector(
            `[data-blocked-date-id="${CSS.escape(id)}"] button[type="submit"]`,
          )
        : null;
    // "Block a date" is hidden while the panel is open, so the panel's date
    // input stands in for it then.
    const blockTarget =
      blockButtonRef.current ??
      sectionRef.current?.querySelector("#local_date");
    const target =
      focusRequest.target === "neighbour"
        ? findRemoveButton(focusRequest.nextId) ??
          findRemoveButton(focusRequest.previousId) ??
          blockTarget
        : blockTarget;

    target?.focus();
  }, [focusRequest]);

  const openPanel = () => {
    setStatusMessage("");
    setFocusRequest(null);
    setPanelOpen(true);
  };

  const closePanel = () => {
    setPanelOpen(false);
    setFocusRequest({ target: "block" });
  };

  const handleBlocked = (localDate) => {
    setStatusMessage(`Blocked ${formatBlockedDate(localDate, today)}`);
    closePanel();
  };

  return (
    <section ref={sectionRef} className="mt-12 flex flex-col gap-4">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">Blocked dates</h2>
        <p className="mt-1 text-sm text-black/60">
          Days you won&apos;t take bookings, even if you normally work.
        </p>
      </div>

      {blockedDates.length ? (
        <ul className="flex flex-col">
          {blockedDates.map((blockedDate) => {
            const localDate = String(blockedDate.local_date).slice(0, 10);
            const label = formatBlockedDate(localDate, today);
            const bookingsLine = formatBlockedDateBookingsLine(
              countsByDate[localDate],
            );
            const closedAnyway = isBlockedDateOnClosedWeekday(localDate, days);

            return (
              <li
                key={blockedDate.id}
                data-blocked-date-id={blockedDate.id}
                className="flex min-h-14 items-center gap-3 border-b border-black/10 py-2"
              >
                <div className="min-w-0 flex-1 break-words">
                  <p className="text-sm font-medium">{label}</p>
                  {bookingsLine ? (
                    <p className="text-sm text-black/60">{bookingsLine}</p>
                  ) : null}
                  {closedAnyway ? (
                    <p className="text-sm text-black/60">
                      {formatClosedAnyway(localDate)}
                    </p>
                  ) : null}
                </div>
                <form action={removeAction} className="shrink-0">
                  <input
                    type="hidden"
                    name="blocked_date_id"
                    value={blockedDate.id}
                  />
                  <PendingButton
                    variant="secondary"
                    aria-label={`Remove ${label}`}
                    className="min-h-11"
                  >
                    Remove
                  </PendingButton>
                </form>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-sm text-black/60">No blocked dates.</p>
      )}

      <p role="status" className="text-sm">
        {statusMessage}
      </p>

      {panelOpen ? (
        <BlockDatePanel
          bookingCountsByDate={countsByDate}
          today={today}
          blockDate={blockDate}
          onBlocked={handleBlocked}
          onCancel={closePanel}
        />
      ) : (
        <Button
          ref={blockButtonRef}
          type="button"
          variant="secondary"
          onClick={openPanel}
          className="min-h-11 self-start"
        >
          Block a date
        </Button>
      )}
    </section>
  );
}
