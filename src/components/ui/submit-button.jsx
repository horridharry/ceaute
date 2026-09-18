"use client";

import { useFormStatus } from "react-dom";
import { buttonClassName } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

// The committing button. React tracks the surrounding form's submission, so a
// plain server-rendered <form action={serverAction}> gets a pending state and
// duplicate-submission refusal without any client state of its own.
//
// While pending the label is replaced by a 16px spinner and the width is held
// by keeping the label in the layout and hiding it, so nothing shifts.
// `pendingLabel` is not drawn; it is what a screen reader announces.
export function SubmitButton({
  variant = "primary",
  block = true,
  className,
  pendingLabel = "Working",
  disabled = false,
  children,
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
      aria-label={pending ? pendingLabel : undefined}
      className={buttonClassName({
        variant,
        block,
        className: `relative ${className ?? ""}`.trim(),
      })}
    >
      <span className={pending ? "invisible" : undefined}>{children}</span>
      {pending ? (
        <span className="absolute inset-0 grid place-items-center">
          <Spinner />
        </span>
      ) : null}
    </button>
  );
}
