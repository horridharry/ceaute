"use client";

// A modal question before an action that matters (archive, delete, cancel a
// booking, unpublish), or an explanation when an action is not allowed
// (blocked). It is the pattern of the Availability closed-week dialog and the
// unsaved-changes dialog: a native <dialog> opened with showModal(), so focus
// is trapped and the page behind is inert.
//
// Focus starts on the safe choice. Escape means the safe choice (except while
// the confirmed action is running). When the dialog closes, focus returns to
// whatever opened it; if that element has gone (the item left the list),
// fallbackFocusRef is used instead. Errors stay inside the dialog.
import { useEffect, useId, useRef } from "react";
import { Button } from "./button";
import { FormError } from "./form-feedback";

export function ConfirmDialog({
  open,
  title,
  description,
  children = null,
  confirmLabel = "Confirm",
  pendingLabel = "Working…",
  cancelLabel = "Cancel",
  tone = "destructive",
  blocked = false,
  pending = false,
  error = "",
  onConfirm = () => {},
  onCancel,
  fallbackFocusRef = null,
}) {
  const dialogRef = useRef(null);
  const safeRef = useRef(null);
  const openerRef = useRef(null);
  const openRef = useRef(open);
  const pendingRef = useRef(pending);
  const titleId = useId();
  const bodyId = useId();

  useEffect(() => {
    pendingRef.current = pending;
  }, [pending]);

  useEffect(() => {
    openRef.current = open;
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) {
      openerRef.current = document.activeElement;
      dialog.showModal();
      safeRef.current?.focus();
    } else if (!open && dialog.open) {
      dialog.close();
      const opener = openerRef.current;
      const target = opener?.isConnected ? opener : fallbackFocusRef?.current;
      target?.focus?.();
    }
  }, [open, fallbackFocusRef]);

  const cancel = () => {
    if (!pendingRef.current) onCancel();
  };

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      aria-describedby={description ? bodyId : undefined}
      onCancel={(event) => {
        // Escape. The effect above closes the dialog once the caller agrees.
        event.preventDefault();
        cancel();
      }}
      onClose={() => {
        // A close the browser made on its own (Chrome does on a repeated
        // Escape) counts as the safe choice.
        if (openRef.current) cancel();
      }}
      className="m-auto w-[calc(100%-2.5rem)] max-w-[400px] rounded-2xl bg-surface p-5 text-ink shadow-xl backdrop:bg-scrim"
    >
      <h2 id={titleId} className="text-lg font-semibold tracking-tight">
        {title}
      </h2>
      {description ? (
        <p id={bodyId} className="mt-2 text-sm text-ink-muted">
          {description}
        </p>
      ) : null}
      {children}
      <FormError className="mt-3">{error}</FormError>
      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:justify-end">
        {blocked ? (
          <Button ref={safeRef} type="button" variant="primary" onClick={cancel}>
            OK
          </Button>
        ) : (
          <>
            <Button
              ref={safeRef}
              type="button"
              variant="secondary"
              disabled={pending}
              onClick={cancel}
            >
              {cancelLabel}
            </Button>
            <Button
              type="button"
              variant={tone === "destructive" ? "destructive-strong" : "primary"}
              disabled={pending}
              aria-busy={pending || undefined}
              onClick={onConfirm}
            >
              {pending ? pendingLabel : confirmLabel}
            </Button>
          </>
        )}
      </div>
    </dialog>
  );
}
