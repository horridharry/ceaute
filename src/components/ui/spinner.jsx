// The only animation in the product besides chip, slot and modal entry. It
// appears inside a button that is committing an action and nowhere else — no
// page spinners, no skeletons (01-foundations.md "Loading").
export function Spinner({ className = "" }) {
  return (
    <span
      aria-hidden="true"
      className={`inline-block size-4 animate-spin rounded-full border-2 border-current border-t-transparent ${className}`}
    />
  );
}
