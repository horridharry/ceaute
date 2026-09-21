"use client";

import { useFormStatus } from "react-dom";
import { Button } from "./button";

// Submit button for a <form action={serverAction}> rendered by a Server
// Component, composing the ui Button primitive above. Preserves the pending
// behaviour of src/components/pending-button.jsx exactly: React tracks the
// surrounding form's submission, so the button shows its pending label and
// refuses duplicate submissions without the form needing useActionState or
// any client state of its own.
//
// This is a NEW file alongside src/components/pending-button.jsx, not a
// replacement for it -- nothing has been migrated to it. Consolidating the
// two is left for the lead to decide at a later task.
export function PendingButton({
  children,
  pendingLabel,
  disabled = false,
  ...buttonProps
}) {
  const { pending } = useFormStatus();
  const isDisabled = pending || disabled;

  return (
    <Button
      type="submit"
      {...buttonProps}
      disabled={isDisabled}
      aria-disabled={isDisabled}
      aria-busy={pending || undefined}
    >
      {pending ? pendingLabel ?? children : children}
    </Button>
  );
}
