// Inputs — 02-components.md "Inputs". The box itself is the `.field` class in
// globals.css, because ~75 controls already carry it; these components add the
// label, the optional suffix and the one message line.
//
// Two rules the components cannot enforce, so they are written here: at most
// one helper line per screen — if a field needs explaining, the field is wrong
// — and optional fields are marked with a label suffix, never required ones
// with an asterisk.

function messageIds(id, { helper, error }) {
  if (error) return { describedBy: `${id}-error` };
  if (helper) return { describedBy: `${id}-helper` };
  return { describedBy: undefined };
}

export function Field({
  id,
  label,
  optional = false,
  helper,
  error,
  className = "",
  children,
}) {
  return (
    <div className={`field-set ${className}`.trim()}>
      {label ? (
        <label htmlFor={id} className="label">
          {label}
          {optional ? (
            <span className="font-normal text-black/45"> — optional</span>
          ) : null}
        </label>
      ) : null}
      {children}
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-[11.5px] text-bad">
          {error}
        </p>
      ) : null}
      {!error && helper ? (
        <p id={`${id}-helper`} className="text-[11.5px] text-black/45">
          {helper}
        </p>
      ) : null}
    </div>
  );
}

export function TextInput({
  id,
  name,
  label,
  optional = false,
  helper,
  error,
  className = "",
  fieldClassName = "",
  ...inputProps
}) {
  const fieldId = id ?? name;
  const { describedBy } = messageIds(fieldId, { helper, error });

  return (
    <Field
      id={fieldId}
      label={label}
      optional={optional}
      helper={helper}
      error={error}
      className={fieldClassName}
    >
      <input
        id={fieldId}
        name={name}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        {...inputProps}
        className={`field ${className}`.trim()}
      />
    </Field>
  );
}

// Grows to six lines and then scrolls. `field-sizing-content` does the growing
// where the browser supports it; elsewhere it stays at its `rows` height,
// which is the same box, just not elastic.
export function TextArea({
  id,
  name,
  label,
  optional = false,
  helper,
  error,
  rows = 3,
  className = "",
  fieldClassName = "",
  ...textareaProps
}) {
  const fieldId = id ?? name;
  const { describedBy } = messageIds(fieldId, { helper, error });

  return (
    <Field
      id={fieldId}
      label={label}
      optional={optional}
      helper={helper}
      error={error}
      className={fieldClassName}
    >
      <textarea
        id={fieldId}
        name={name}
        rows={rows}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        {...textareaProps}
        className={`field max-h-[146px] resize-none overflow-y-auto text-[13.5px]/[1.5] field-sizing-content ${className}`.trim()}
      />
    </Field>
  );
}

export function Select({
  id,
  name,
  label,
  optional = false,
  helper,
  error,
  className = "",
  fieldClassName = "",
  children,
  ...selectProps
}) {
  const fieldId = id ?? name;
  const { describedBy } = messageIds(fieldId, { helper, error });

  return (
    <Field
      id={fieldId}
      label={label}
      optional={optional}
      helper={helper}
      error={error}
      className={fieldClassName}
    >
      <div className="relative">
        <select
          id={fieldId}
          name={name}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          {...selectProps}
          className={`field appearance-none pr-9 ${className}`.trim()}
        >
          {children}
        </select>
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-[13px] text-black/45"
        >
          ⌄
        </span>
      </div>
    </Field>
  );
}

// The one filled input in the product: surface fill, no border, no label.
export function SearchInput({ className = "", ...inputProps }) {
  return (
    <div className="relative">
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center"
      >
        <span className="block size-[13px] rounded-full border-[1.5px] border-black/35" />
      </span>
      <input
        type="search"
        {...inputProps}
        className={`block h-12 w-full rounded-control border-0 bg-surface pl-9 pr-3.5 text-[14px] text-ink outline-none placeholder:text-black/35 focus:ring-[1.5px] focus:ring-plum focus:ring-inset ${className}`.trim()}
      />
    </div>
  );
}

// Side by side is for price + duration and city + postcode. Everything else is
// one field per row.
export function FieldPair({ className = "", children }) {
  return (
    <div className={`grid grid-cols-2 gap-[13px] ${className}`.trim()}>
      {children}
    </div>
  );
}

// Between form fields is 13px, laid out with gap rather than margins.
export function FieldStack({ className = "", children }) {
  return (
    <div className={`flex flex-col gap-[13px] ${className}`.trim()}>
      {children}
    </div>
  );
}
