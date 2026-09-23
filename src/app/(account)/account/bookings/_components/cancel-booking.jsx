"use client";

import { useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { cancelCustomerBooking } from "../actions";

// Cancelling asks first and says what happens to the money now: all of it
// back before the deadline; after it, the provider keeps their share of what
// was paid. PostgreSQL decides the actual refund when the booking is
// cancelled, and the outcome shown afterwards is the one it decided.
export function CancelBooking({ bookingId, preview, canCancel = true }) {
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [outcome, setOutcome] = useState("");
  const statusRef = useRef(null);

  const confirm = () => {
    startTransition(async () => {
      const formData = new FormData();
      formData.set("booking_id", bookingId);
      const result = await cancelCustomerBooking(null, formData);

      if (result.status === "cancelled") {
        setOpen(false);
        setError("");
        setOutcome(result.message);
        statusRef.current?.focus();
      } else {
        setError(result.message);
      }
    });
  };

  return (
    <div className="mt-4">
      <p ref={statusRef} tabIndex={-1} role="status" className="text-sm text-ink-muted outline-none">
        {outcome}
      </p>
      {outcome || !canCancel ? null : (
        <Button
          type="button"
          variant="destructive"
          className="-ml-4"
          onClick={() => {
            setError("");
            setOpen(true);
          }}
        >
          Cancel booking
        </Button>
      )}
      <ConfirmDialog
        open={open}
        title="Cancel this booking?"
        description={preview.description}
        cancelLabel="Keep booking"
        confirmLabel={preview.confirmLabel}
        pendingLabel="Cancelling…"
        pending={pending}
        error={error}
        onConfirm={confirm}
        onCancel={() => setOpen(false)}
        fallbackFocusRef={statusRef}
      />
    </div>
  );
}
