// Thin wrapper over the native <input type="checkbox">. 5 of the 6
// hand-rolled checkboxes in the codebase are unstyled beyond a "h-4 w-4"
// size: the two booking-cancellation confirmations, the two add-on toggles
// (treatment-selection.jsx, book/[treatmentId]/page.jsx), and the
// compatible-treatments toggle in treatment-add-on-form.jsx. The sixth
// (availability-form.jsx's weekday-enabled toggle) is a fully custom-painted
// control -- appearance-none with its own border, radius, and checked/hover/
// focus states -- and is a different control, not a variation of this one.
import { composeClassName } from "./class-names";

export function Checkbox({ className, ...rest }) {
  return (
    <input
      {...rest}
      type="checkbox"
      className={composeClassName("h-4 w-4", className)}
    />
  );
}
