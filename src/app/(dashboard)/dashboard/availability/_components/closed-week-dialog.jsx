"use client";

// Asks a published provider to confirm saving a week with every day closed.
// Presentational: WeeklyScheduleForm decides when it's open and what each
// button does. Matches the shared unsaved-changes dialog
// (src/components/unsaved-changes/unsaved-changes-provider.jsx).
import { useEffect, useId, useRef } from "react";
import { Button } from "@/components/ui/button";

export function ClosedWeekDialog({ open, onKeepEditing, onConfirm }) {
  const dialogRef = useRef(null);
  const keepEditingRef = useRef(null);
  const openRef = useRef(open);
  const titleId = useId();
  const bodyId = useId();

  useEffect(() => {
    openRef.current = open;
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      keepEditingRef.current?.focus();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      aria-describedby={bodyId}
      onKeyDown={(event) => {
        // Escape means Keep editing. Handled here as well as in onCancel
        // because not every browser turns Escape into a cancel event;
        // preventDefault stops the ones that do from firing it too.
        if (event.key === "Escape") {
          event.preventDefault();
          onKeepEditing();
        }
      }}
      onCancel={(event) => {
        // Escape means Keep editing. The effect above closes the dialog.
        event.preventDefault();
        onKeepEditing();
      }}
      onClose={() => {
        // Only a close the browser made on its own (Chrome does on a repeated
        // Escape) counts as Keep editing; closes from the effect are ignored.
        if (openRef.current) onKeepEditing();
      }}
      className="m-auto w-[calc(100%-2.5rem)] max-w-[400px] rounded-2xl bg-white p-5 text-black shadow-xl backdrop:bg-black/40"
    >
      <h2 id={titleId} className="text-lg font-semibold tracking-tight">
        Close every day?
      </h2>
      <p id={bodyId} className="mt-2 text-sm text-black/60">
        Your page will stay live, but customers won&apos;t be able to make new
        bookings until you add hours.
      </p>
      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:justify-end">
        <Button
          ref={keepEditingRef}
          type="button"
          variant="secondary"
          className="min-h-11"
          onClick={onKeepEditing}
        >
          Keep editing
        </Button>
        <Button
          type="button"
          variant="primary"
          className="min-h-11"
          onClick={onConfirm}
        >
          Save closed week
        </Button>
      </div>
    </dialog>
  );
}
