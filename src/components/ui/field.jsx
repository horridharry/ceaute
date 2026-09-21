// Label + optional error message wrapping a form control. This is the same
// label+error shape already established by
// src/app/(dashboard)/dashboard/_components/form-field.jsx (13 call sites
// across 3 files: treatment-form.jsx, treatment-add-on-form.jsx, and
// location-form-ui.jsx), reusing its exact classes (`.field-set`, `.label`,
// and "text-sm text-red-600" for the error line -- src/app/globals.css:4
// and :9). It intentionally does not grow the API with the "help text" or
// "optional" variations seen elsewhere (e.g. provider-page-form.jsx's
// opacity-toggled validation message, or a bare paragraph with no wrapper at
// all) -- those are not the same demonstrated pattern.
//
// This is a NEW file alongside the existing FormField, not a replacement --
// nothing has been migrated to it. Consolidating the two is left for the
// lead to decide at a later task, same as PendingButton.
import { composeClassName } from "./class-names";

export function Field({
  label,
  htmlFor,
  error = "",
  reserveErrorSpace = false,
  className,
  children,
}) {
  return (
    <span className={composeClassName("field-set", className)}>
      <label htmlFor={htmlFor} className="label">
        {label}
      </label>
      {error || reserveErrorSpace ? (
        <p className="text-sm text-red-600">{error}</p>
      ) : null}
      {children}
    </span>
  );
}
