// 38 × 22 track, 18px knob with a 2px inset, plum when on. The whole row is
// the label, so the text is part of the tap target.
export function Toggle({
  name,
  label,
  description,
  defaultChecked,
  checked,
  onChange,
  disabled = false,
  className = "",
}) {
  return (
    <label
      className={`flex min-h-11 cursor-pointer items-center justify-between gap-4 has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-50 ${className}`.trim()}
    >
      <span className="flex flex-col gap-0.5">
        <span className="text-[14px] font-medium text-ink">{label}</span>
        {description ? (
          <span className="text-[12.5px] text-black/60">{description}</span>
        ) : null}
      </span>
      <input
        type="checkbox"
        name={name}
        defaultChecked={defaultChecked}
        checked={checked}
        onChange={onChange}
        disabled={disabled}
        className="peer sr-only"
      />
      <span className="relative block h-[22px] w-[38px] shrink-0 rounded-full bg-black/14 transition duration-150 ease-out peer-checked:bg-plum peer-checked:[&>span]:translate-x-4 peer-focus-visible:ring-2 peer-focus-visible:ring-plum peer-focus-visible:ring-offset-2">
        <span className="absolute left-0.5 top-0.5 block size-[18px] rounded-full bg-white transition duration-150 ease-out" />
      </span>
    </label>
  );
}
