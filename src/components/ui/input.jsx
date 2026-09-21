// Thin wrapper over the native <input>, applying the `.field` style that
// every hand-rolled <input> using it already shares (src/app/globals.css:4).
// Does not cover type="checkbox" -- see ./checkbox.jsx for that, which has
// different, simpler styling and different reuse evidence.
import { composeClassName } from "./class-names";

export function Input({ className, ...rest }) {
  return <input className={composeClassName("field", className)} {...rest} />;
}
