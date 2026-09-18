// Used only where each choice needs a line of explanation — payment mode,
// cancellation window. Two side by side. The selected card takes a 1.5px plum
// border, never a fill: the accent is used at full strength or not at all.
export function OptionCard({
  name,
  value,
  title,
  explanation,
  defaultChecked,
  checked,
  onChange,
  disabled = false,
  className = "",
}) {
  return (
    <label
      className={`flex cursor-pointer flex-col gap-1 rounded-row border p-[13px] transition duration-150 ease-out has-[:checked]:border-[1.5px] has-[:checked]:border-plum has-[:checked]:p-[12.5px] has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-50 border-black/12 ${className}`.trim()}
    >
      <input
        type="radio"
        name={name}
        value={value}
        defaultChecked={defaultChecked}
        checked={checked}
        onChange={onChange}
        disabled={disabled}
        className="sr-only"
      />
      <span className="text-[14px] font-medium text-ink">{title}</span>
      {explanation ? (
        <span className="text-[12px] text-black/60">{explanation}</span>
      ) : null}
    </label>
  );
}

export function OptionCardPair({ className = "", children }) {
  return (
    <div className={`grid grid-cols-2 gap-2 ${className}`.trim()}>{children}</div>
  );
}
