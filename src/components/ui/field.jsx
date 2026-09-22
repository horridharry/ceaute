// A label, optional hint and error, and the control they describe.
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

  return (
    <span className={composeClassName("field-set", className)}>
      <label htmlFor={htmlFor} className="label">
        {label}
        {optional ? <OptionalMarker /> : null}
      </label>
      {hint ? (
        <p id={ids.hint} className="text-sm text-ink-muted">
          {hint}
        </p>
      ) : null}
      {error || reserveErrorSpace ? (
        <p id={error ? ids.error : undefined} className="text-sm text-danger">
          {error}
        </p>
      ) : null}
      {control}
    </span>
  );
}
