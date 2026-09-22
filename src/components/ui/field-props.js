// How a form control is tied to its label, hint and error. Field gives every
// hint and error an id derived from the control's id, and fieldControlProps
// returns the attributes the control needs to point at them, so a screen
// reader reads the error when the control has focus.
export function fieldDescriptionIds(id) {
  return { hint: `${id}-hint`, error: `${id}-error` };
}

export function fieldControlProps(id, { hint, error } = {}) {
  const ids = fieldDescriptionIds(id);
  const describedBy = [hint ? ids.hint : null, error ? ids.error : null]
    .filter(Boolean)
    .join(" ");

  return {
    id,
    "aria-invalid": error ? true : undefined,
    "aria-describedby": describedBy || undefined,
  };
}
