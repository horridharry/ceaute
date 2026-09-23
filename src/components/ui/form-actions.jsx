// The end of a create or edit form, following Booking settings: one
// right-aligned primary submit, with an optional neutral status ("Saved") on
// the left. Every form has exactly one of these and no other submit.
//
// discardHref adds Discard before the submit (approved 23 September 2026). It
// is a plain link back to the list: with no changes it simply leaves, and
// with unsaved changes the shared guard asks first (see
// useFormUnsavedGuard).
import Link from "next/link";
import { buttonClassName } from "./button-classes";
import { composeClassName } from "./class-names";
import { FormStatus } from "./form-feedback";

export function FormActions({ status = "", discardHref = "", className = "", children }) {
  return (
    <div className={composeClassName("mt-3 flex items-center justify-end gap-3", className)}>
      {status ? <FormStatus className="mr-auto">{status}</FormStatus> : null}
      {discardHref ? (
        <Link href={discardHref} className={buttonClassName({ variant: "outline" })}>
          Discard
        </Link>
      ) : null}
      {children}
    </div>
  );
}
