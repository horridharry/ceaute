export function FormField({
  label,
  htmlFor,
  error = "",
  reserveErrorSpace = false,
  children,
}) {
  return (
    <span className="field-set">
      <label htmlFor={htmlFor} className="label">
        {label}
      </label>
      {error || reserveErrorSpace ? (
        <p className="text-sm text-red-600">{error}</p>
      ) : null}
      {children}
    </span>
  );
}
