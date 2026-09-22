// Messages about a whole form rather than one field.
//
// FormError is an alert: it appears after a failed submission or when the
// form as a whole is invalid, and is announced once when it appears.
// FormStatus is a polite status for progress and success ("Saved"), which
// screen readers read without interrupting.
import { composeClassName } from "./class-names";

export function FormError({ children, className = "" }) {
  if (!children) {
    return null;
  }

  return (
    <p role="alert" className={composeClassName("text-sm text-danger", className)}>
      {children}
    </p>
  );
}

export function FormStatus({ children, className = "" }) {
  return (
    <p
      role="status"
      aria-live="polite"
      className={composeClassName("text-sm text-ink-muted", className)}
    >
      {children}
    </p>
  );
}
