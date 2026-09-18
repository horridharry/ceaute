"use client";

import { useRef, useState } from "react";

// The six-digit sign-in code. One real input carries the value, so paste, the
// iOS one-time-code keyboard and autofill all behave normally; the six cells
// are a drawing of that value inside a single focus box. An unfilled position
// shows a centre dot rather than an empty well.
export function CodeInput({
  id = "code",
  name = "code",
  length = 6,
  autoFocus = false,
  error,
  onComplete,
  onValueChange,
  ...inputProps
}) {
  const inputRef = useRef(null);
  const [value, setValue] = useState("");
  const [focused, setFocused] = useState(false);

  // `onValueChange` reports the digits so a caller can keep its own submit
  // button disabled until the code is complete. A raw `onChange` would land
  // after this component's own handler in the spread below and replace it.
  function handleChange(event) {
    const digits = event.target.value.replace(/\D/g, "").slice(0, length);
    setValue(digits);
    onValueChange?.(digits);
    if (digits.length === length) onComplete?.(digits);
  }

  const cells = Array.from({ length }, (_, index) => value[index] ?? "");
  const activeIndex = Math.min(value.length, length - 1);

  return (
    <div className="flex flex-col gap-1.5">
      <div
        onClick={() => inputRef.current?.focus()}
        className={`relative flex items-center justify-center gap-1.5 rounded-field bg-white px-2 py-2.5 transition duration-150 ease-out ${
          error
            ? "border-[1.5px] border-bad"
            : focused
              ? "border-[1.5px] border-plum"
              : "border border-black/16"
        }`}
      >
        <input
          ref={inputRef}
          id={id}
          name={name}
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          autoFocus={autoFocus}
          maxLength={length}
          value={value}
          onChange={handleChange}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          aria-invalid={error ? true : undefined}
          aria-label={`${length}-digit code`}
          {...inputProps}
          className="absolute inset-0 size-full rounded-field bg-transparent text-transparent caret-transparent opacity-0 outline-none"
        />
        {cells.map((digit, index) => (
          <span
            key={index}
            aria-hidden="true"
            className="flex h-12 flex-1 items-center justify-center text-[26px] font-semibold tracking-[0.1em] tabular-nums text-ink"
          >
            {digit || (
              <span
                className={`block size-1.5 rounded-full bg-black/20 ${
                  focused && index === activeIndex ? "bg-plum" : ""
                }`}
              />
            )}
          </span>
        ))}
      </div>
      {error ? (
        <p role="alert" className="text-[11.5px] text-bad">
          {error}
        </p>
      ) : null}
    </div>
  );
}
