"use client";

import { useState } from "react";
import { Field } from "@/components/ui/field";

// Price — numeric keypad, £ fixed as a prefix rather than typed, two decimals
// applied on blur so a provider can type `40` and get `40.00`.
export function PriceInput({
  id,
  name,
  label = "Price",
  optional = false,
  helper,
  error,
  defaultValue = "",
  className = "",
  ...inputProps
}) {
  const fieldId = id ?? name;
  const [value, setValue] = useState(String(defaultValue ?? ""));

  function applyTwoDecimals() {
    const amount = Number.parseFloat(value.replace(/[^0-9.]/g, ""));
    setValue(Number.isFinite(amount) ? amount.toFixed(2) : "");
  }

  return (
    <Field
      id={fieldId}
      label={label}
      optional={optional}
      helper={helper}
      error={error}
    >
      <div className="relative">
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 left-[13px] flex items-center text-[14px] text-black/45"
        >
          £
        </span>
        <input
          id={fieldId}
          name={name}
          type="text"
          inputMode="decimal"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onBlur={applyTwoDecimals}
          aria-invalid={error ? true : undefined}
          {...inputProps}
          className={`field pl-[26px] ${className}`.trim()}
        />
      </div>
    </Field>
  );
}
