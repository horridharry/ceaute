export function FormField({ label, htmlFor, error = "", helper = "", children }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-xs font-medium text-black">
        {label}
      </label>
      {children}
      {error ? (
        <p className="text-xs text-bad">{error}</p>
      ) : helper ? (
        <p className="text-xs text-black/45">{helper}</p>
      ) : null}
    </div>
  );
}
