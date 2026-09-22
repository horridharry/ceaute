// What a submit button shows and allows while its form is submitting. Kept
// pure so the rule is tested directly: a pending button is disabled (which
// is what stops a second submission), says it is busy, and swaps to its
// pending label when it has one.
export function pendingButtonState({
  pending = false,
  disabled = false,
  children,
  pendingLabel,
}) {
  const isDisabled = Boolean(pending || disabled);

  return {
    disabled: isDisabled,
    "aria-disabled": isDisabled,
    "aria-busy": pending ? true : undefined,
    label: pending ? pendingLabel ?? children : children,
  };
}
