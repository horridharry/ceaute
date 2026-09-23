// The end of a create or edit form, following Booking settings: one
// right-aligned primary submit, with an optional neutral status ("Saved") on
// the left. Every form has exactly one of these and no other submit.
import { composeClassName } from "./class-names";
import { FormStatus } from "./form-feedback";

export function FormActions({ status = "", className = "", children }) {
  return (
    <div className={composeClassName("mt-3 flex items-center justify-end gap-3", className)}>
      {status ? <FormStatus className="mr-auto">{status}</FormStatus> : null}
      {children}
    </div>
  );
}
