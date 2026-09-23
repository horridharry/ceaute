// A form's values as one comparable string, so a screen can tell whether
// anything differs from what it loaded without tracking every field. Pure:
// takes the entries of a FormData (or any [name, value] pairs).
//
// File inputs are compared by name and size only; none of the forms that use
// this upload files today.
export function formSnapshot(entries) {
  const pairs = [];

  for (const [name, value] of entries) {
    const text =
      typeof value === "string"
        ? value
        : value && typeof value === "object" && "size" in value
          ? `file:${value.name ?? ""}:${value.size}`
          : String(value ?? "");
    pairs.push([name, text]);
  }

  return JSON.stringify(pairs);
}

export function isFormChanged(initialSnapshot, currentSnapshot) {
  return initialSnapshot !== null && initialSnapshot !== currentSnapshot;
}
