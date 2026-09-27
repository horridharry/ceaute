"use client";

// A time the provider types ("7pm", "19:00") with suggestions below it, as an
// ARIA combobox. `value` is 'HH:MM' or '' and `onChange` hears every change to
// it: a typed time counts as soon as it reads as one time, and anything else
// ("7", which could be morning or evening) leaves the value '' until a
// suggestion is chosen. Leaving the field or pressing Enter shows a time the
// app's way ("7 pm"), keeps the suggestions open for text that needs one of
// them, and otherwise explains what is wrong. Nothing is rounded.
//
// With `onPick`, choosing a time (Enter, or tapping a suggestion) hands it to
// onPick and empties the field for the next one, as the Start times list does.
import { useState } from "react";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { formatClockTime } from "@/lib/time/clock-time";
import { readTimeText, timeTextError } from "../_lib/time-text";

const display = (value) => (value ? formatClockTime(value) : "");

export function TimeInput({
  id,
  label,
  value,
  disabled = false,
  onChange,
  onPick,
  inputRef,
  className,
}) {
  const [text, setText] = useState(() => display(value));
  const [shownValue, setShownValue] = useState(value);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [error, setError] = useState("");

  const reading = readTimeText(text);

  // A value changed from outside (the Start times field emptied after Add
  // time) replaces the text; a value this field reported leaves it alone.
  if (value !== shownValue) {
    setShownValue(value);
    if (value !== reading.value) {
      setText(display(value));
      setOpen(false);
      setActive(-1);
      setError("");
    }
  }

  const suggestions = open && !disabled ? reading.suggestions : [];
  const expanded = suggestions.length > 0;
  const listId = `${id}-suggestions`;
  const optionId = (index) => `${id}-option-${index}`;

  const report = (next) => {
    if (next !== value) onChange?.(next);
  };

  const close = () => {
    setOpen(false);
    setActive(-1);
  };

  const choose = (next) => {
    close();
    setError("");

    if (onPick) {
      setText("");
      report("");
      onPick(next);
      return;
    }

    setText(display(next));
    report(next);
  };

  // Leaving the field, or Enter with no suggestion highlighted.
  const settle = ({ pick }) => {
    if (reading.kind === "time") {
      if (pick && onPick) {
        choose(reading.value);
        return;
      }
      setText(display(reading.value));
      close();
      return;
    }

    if (reading.suggestions.length > 0) {
      setOpen(true);
      return;
    }

    close();
    setError(timeTextError(reading));
  };

  const handleChange = (event) => {
    const nextText = event.target.value;
    const next = readTimeText(nextText);

    setText(nextText);
    setError("");
    setOpen(next.suggestions.length > 0);
    setActive(-1);
    report(next.value);
  };

  const handleKeyDown = (event) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      if (reading.suggestions.length === 0) return;
      event.preventDefault();

      if (!expanded) {
        setOpen(true);
        setActive(event.key === "ArrowDown" ? 0 : reading.suggestions.length - 1);
        return;
      }

      setActive((current) =>
        event.key === "ArrowDown"
          ? Math.min(current + 1, suggestions.length - 1)
          : Math.max(current - 1, 0),
      );
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();

      if (expanded && active >= 0) {
        choose(suggestions[active]);
        return;
      }

      settle({ pick: true });
      return;
    }

    if (event.key === "Escape" && expanded) {
      event.preventDefault();
      close();
    }
  };

  return (
    <Field label={label} htmlFor={id} error={error} className={className}>
      {(control) => (
        <span className="relative block">
          <Input
            {...control}
            ref={inputRef}
            type="text"
            role="combobox"
            aria-expanded={expanded}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={expanded && active >= 0 ? optionId(active) : undefined}
            autoComplete="off"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="done"
            value={text}
            disabled={disabled}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            onBlur={() => settle({ pick: false })}
            className="min-h-11 w-full min-w-0 tabular-nums"
          />
          <ul
            id={listId}
            role="listbox"
            aria-label={label}
            className={
              expanded
                ? "absolute inset-x-0 top-full z-10 mt-1 flex flex-col overflow-hidden rounded-lg border border-line bg-surface py-1 shadow-sm"
                : "hidden"
            }
          >
            {suggestions.map((suggestion, index) => (
              <li
                key={suggestion}
                id={optionId(index)}
                role="option"
                aria-selected={index === active}
                // Keeps focus in the field, so choosing isn't also leaving.
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => choose(suggestion)}
                className={`flex min-h-11 cursor-pointer items-center px-3 text-sm tabular-nums hover:bg-surface-subtle ${
                  index === active ? "bg-surface-subtle font-medium" : ""
                }`}
              >
                {formatClockTime(suggestion)}
              </li>
            ))}
          </ul>
        </span>
      )}
    </Field>
  );
}
