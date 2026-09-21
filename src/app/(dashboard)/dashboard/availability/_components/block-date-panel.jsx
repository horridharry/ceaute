"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { keepFormValuesOnSubmit } from "@/lib/forms/keep-form-values";
import { formatBookingsOnDateMessage } from "../_lib/booking-messages";
import { formatBlockedDate } from "../_lib/schedule-form";

const ERROR_ID = "local_date_error";
const BOOKINGS_ID = "local_date_bookings";

// Date field for blocking one day. Counts come from the page load only, so
// nothing is fetched while the provider picks a date. The parent unmounts
// this panel to close it, which also clears the chosen date.
export function BlockDatePanel({
  bookingCountsByDate,
  today,
  blockDate,
  onBlocked,
  onCancel,
}) {
  const [localDate, setLocalDate] = useState("");
  const inputRef = useRef(null);
  const [state, blockDateAction, pending] = useActionState(
    async (currentState, formData) => {
      const result = await blockDate(currentState, formData);

      if (result?.status === "blocked") {
        onBlocked(result.localDate);
      }

      return result;
    },
    { status: "idle" },
  );
  const errorMessage = state.status === "error" ? state.message : "";
  const bookingsMessage = localDate
    ? formatBookingsOnDateMessage(
        bookingCountsByDate[localDate],
        formatBlockedDate(localDate, today),
      )
    : "";
  const describedBy =
    [errorMessage ? ERROR_ID : "", bookingsMessage ? BOOKINGS_ID : ""]
      .filter(Boolean)
      .join(" ") || undefined;

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleKeyDown = (event) => {
    if (event.key === "Escape" && !pending) {
      event.preventDefault();
      onCancel();
    }
  };

  return (
    <form
      action={blockDateAction}
      onSubmit={keepFormValuesOnSubmit(blockDateAction)}
      onKeyDown={handleKeyDown}
      className="flex flex-col gap-3"
    >
      <span className="field-set">
        <label className="label" htmlFor="local_date">
          Date
        </label>
        <input
          ref={inputRef}
          id="local_date"
          name="local_date"
          type="date"
          min={today}
          value={localDate}
          onChange={(event) => setLocalDate(event.target.value)}
          disabled={pending}
          aria-invalid={errorMessage ? true : undefined}
          aria-describedby={describedBy}
          className="field w-full min-w-0"
        />
      </span>

      {errorMessage ? (
        <p id={ERROR_ID} className="text-sm text-red-600">
          {errorMessage}
        </p>
      ) : null}

      {bookingsMessage ? (
        <p id={BOOKINGS_ID} className="text-sm text-black/60">
          {bookingsMessage}
        </p>
      ) : null}

      <div className="flex flex-wrap justify-end gap-3">
        <Button
          type="button"
          variant="secondary"
          onClick={onCancel}
          disabled={pending}
          className="min-h-11"
        >
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={pending}
          aria-disabled={pending}
          className="min-h-11"
        >
          {pending ? "Blocking…" : "Block date"}
        </Button>
      </div>
    </form>
  );
}
