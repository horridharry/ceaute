"use client";

import { useFormStatus } from "react-dom";

// Submit button for a <form action={serverAction}> rendered by a Server
// Component. React tracks the surrounding form's submission, so the button
// shows its pending label and refuses duplicate submissions without the form
// needing useActionState or any client state of its own.
//
// Client forms that already use useActionState keep their own pending flag;
// this primitive is for the plain server-rendered forms.
export function PendingButton({
  children,
  pendingLabel,
  disabled = false,
  className,
  ...buttonProps
}) {
  const { pending } = useFormStatus();
  const isDisabled = pending || disabled;

  return (
    <button
      type="submit"
      {...buttonProps}
      disabled={isDisabled}
      aria-disabled={isDisabled}
      aria-busy={pending || undefined}
      className={className}
    >
      {pending ? pendingLabel ?? children : children}
    </button>
  );
}
