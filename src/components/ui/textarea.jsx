// Thin wrapper over the native <textarea>, applying the `.field` style
// every hand-rolled <textarea> already shares (src/app/globals.css:4). 5 of
// the 6 existing textareas also append "resize-none"; the sixth
// (treatment-form.jsx's description field) leaves it resizable. Because
// there is no safe way to remove a baked-in utility class by appending
// another one without a class-merging helper (which this task may not add),
// "resize-none" is left for call sites to append via className -- exactly
// how 5 of the 6 already write it -- rather than baked in as a default that
// the sixth could not opt out of.
import { composeClassName } from "./class-names";

export function Textarea({ className, ...rest }) {
  return <textarea className={composeClassName("field", className)} {...rest} />;
}
