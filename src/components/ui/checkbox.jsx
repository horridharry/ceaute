// 20 × 20, radius 5. Plum fill with a white check when on, a 1.5px border when
// off. The check is a CSS shape, not an icon — the product ships no icon set.
//
// `CheckboxBox` is the drawing on its own, for rows that are already a <label>
// and cannot nest another one inside themselves.
export function CheckboxBox({ className = "" }) {
  return (
    <span
      className={`grid size-5 shrink-0 place-items-center rounded-[5px] border-[1.5px] border-black/25 transition duration-150 ease-out peer-checked:border-plum peer-checked:bg-plum peer-checked:[&>span]:opacity-100 peer-focus-visible:ring-2 peer-focus-visible:ring-plum peer-focus-visible:ring-offset-2 ${className}`.trim()}
    >
      <span
        aria-hidden="true"
        className="mt-px block h-[9px] w-[5px] rotate-45 border-b-2 border-r-2 border-white opacity-0"
      />
    </span>
  );
}

export function Checkbox({
  name,
  value,
  label,
  defaultChecked,
  checked,
  onChange,
  disabled = false,
  className = "",
  "aria-label": ariaLabel,
}) {
  return (
    <label
      className={`inline-flex min-h-11 cursor-pointer items-center gap-2.5 has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-50 ${className}`.trim()}
    >
      <input
        type="checkbox"
        name={name}
        value={value}
        defaultChecked={defaultChecked}
        checked={checked}
        onChange={onChange}
        disabled={disabled}
        aria-label={ariaLabel}
        className="peer sr-only"
      />
      <CheckboxBox />
      {label ? <span className="text-[14px] text-ink">{label}</span> : null}
    </label>
  );
}
