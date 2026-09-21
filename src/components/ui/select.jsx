// Thin wrapper over the native <select>. Every hand-rolled <select> in the
// codebase (9 of 9, no exceptions) applies "field cursor-pointer"
// (src/app/globals.css:4), so that pairing is the primitive's default
// rather than just "field".
import { composeClassName } from "./class-names";

export function Select({ className, ...rest }) {
  return (
    <select
      className={composeClassName("field cursor-pointer", className)}
      {...rest}
    />
  );
}
