// A label, optional hint, the control, and its error.
//
// Pass the control as a function to have Field wire it up:
//   <Field label="Name" htmlFor="name" error={nameError}>
//     {(control) => <Input {...control} name="name" required />}
//   </Field>
// The function receives the id, aria-invalid and aria-describedby. A plain
// child still works, as the older FormField did, but then the caller must
// connect any hint or error itself with fieldControlProps().
//
// Mark a field `optional` only when its validation really lets it be empty;
// required fields carry no marker. Field errors are not live regions: they
// change while the person types and are read with the control instead. A
// form-level error uses <FormError>.
import { composeClassName } from "./class-names";
import { fieldControlProps, fieldDescriptionIds } from "./field-props";

export function OptionalMarker() {
  return <span className="font-normal text-ink-muted"> (optional)</span>;
}

export function Field({
  label,
  htmlFor,
  hint = "",
  error = "",
  optional = false,
  reserveErrorSpace = false,
  className,
  children,
}) {
  const ids = fieldDescriptionIds(htmlFor);
  const control =
    typeof children === "function"
      ? children(fieldControlProps(htmlFor, { hint, error }))
      : children;

  // Label, then hint, then the control, then its error: the label sits 6px
  // above the control and an error appears under what it describes, only
  // when there is one.
  return (
    <span className={composeClassName("flex flex-1 flex-col gap-1.5", className)}>
      <label htmlFor={htmlFor} className="label">
        {label}
        {optional ? <OptionalMarker /> : null}
      </label>
      {hint ? (
        <p id={ids.hint} className="-mt-0.5 text-sm text-ink-muted">
          {hint}
        </p>
      ) : null}
      {control}
      {error || reserveErrorSpace ? (
        <p id={error ? ids.error : undefined} className="text-sm text-danger">
          {error}
        </p>
      ) : null}
    </span>
  );
}
