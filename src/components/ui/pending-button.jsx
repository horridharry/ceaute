"use client";

import { useFormStatus } from "react-dom";
import { buttonClassName } from "./button-classes";
import { pendingButtonState } from "./pending-state";

// Submit button for a <form action={serverAction}>. React tracks the
// surrounding form's submission, so the button shows its pending label and
// refuses duplicate submissions without the form needing useActionState or
// any client state of its own. Client forms that already use useActionState
// keep their own pending flag.
//
// By default it takes a Button variant and size. `unstyled` renders only the
// caller's className, which is how src/components/pending-button.jsx keeps
// its existing consumers (including checkout) exactly as they were.
export function PendingButton({
  children,
  pendingLabel,
  disabled = false,
  unstyled = false,
  variant = "primary",
  size = "md",
  surface = "light",
  className = "",
  ...buttonProps
}) {
  const { pending } = useFormStatus();
  const { label, ...state } = pendingButtonState({
    pending,
    disabled,
    children,
    pendingLabel,
  });

  return (
    <button
      type="submit"
      {...buttonProps}
      {...state}
      className={
        unstyled
          ? className
          : buttonClassName({ variant, size, surface, className })
      }
    >
      {label}
    </button>
  );
}
