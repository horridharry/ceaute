"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useServerAction } from "../../../_lib/use-server-action";

// Cancelling asks first and says what happens: a provider cancellation
// refunds the full amount paid online (prepare_booking_cancellation), the
// time becomes free, and the provider covers Stripe's processing fee. The
// result stays on screen after the page refreshes to its cancelled state.
export function CancelBooking({ bookingId, customerName, refundLabel, canCancel, cancelAction }) {
  const [runCancel, pending] = useServerAction(cancelAction);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [outcome, setOutcome] = useState("");
  const statusRef = useRef(null);
  const firstName = String(customerName ?? "").trim().split(/\s+/)[0] || "The customer";

  const confirm = async () => {
    const result = await runCancel({ booking_id: bookingId, customer_name: customerName });
    if (result.status === "cancelled") {
      setOpen(false);
      setError("");
      setOutcome(result.message);
      statusRef.current?.focus();
    } else {
      setError(result.message);
    }
  };

  return (
    <div className="mt-6">
      <p ref={statusRef} tabIndex={-1} role="status" className="text-sm text-ink-muted outline-none">
        {outcome}
      </p>
      {canCancel ? (
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
      ) : null}
      <ConfirmDialog
        open={open}
        title={`Cancel ${firstName}’s booking?`}
        description={`${firstName} will be refunded ${refundLabel}, the full amount paid online. The time becomes available again. You cover the Stripe processing fee.`}
        cancelLabel="Keep booking"
        confirmLabel="Cancel and refund"
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
