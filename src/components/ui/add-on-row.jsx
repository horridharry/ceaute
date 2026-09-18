"use client";

import { useState } from "react";
import { CheckboxBox } from "@/components/ui/checkbox";

// Add-ons live inside one bordered container, separated by hairlines. The
// delta reads as a delta — `+ £3` or `+ £3 · + 5 min` — because that is what
// the customer is agreeing to, not the add-on's absolute price.
//
// The whole row is the label, so the input is written out here rather than
// composed from <Checkbox>, which brings its own <label> and cannot nest.
export function AddOnRow({
  name,
  delta,
  checked,
  defaultChecked,
  onChange,
  value,
  inputName = "add_on",
  className = "",
}) {
  return (
    <label
      className={`flex min-h-11 cursor-pointer items-center justify-between gap-3 px-3.5 py-3 ${className}`.trim()}
    >
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="truncate text-[14px] text-ink">{name}</span>
        {delta ? <span className="text-[12px] text-black/60">{delta}</span> : null}
      </span>
      <input
        type="checkbox"
        name={inputName}
        value={value}
        checked={checked}
        defaultChecked={defaultChecked}
        onChange={onChange}
        className="peer sr-only"
      />
      <CheckboxBox />
    </label>
  );
}

// Beyond five add-ons the list collapses. The threshold is a presentation
// choice, not a product rule — a provider may define as many as she likes.
export const ADD_ON_COLLAPSE_THRESHOLD = 5;

export function AddOnList({ children, threshold = ADD_ON_COLLAPSE_THRESHOLD, className = "" }) {
  const rows = Array.isArray(children) ? children.flat() : [children];
  const [expanded, setExpanded] = useState(false);
  const hidden = Math.max(0, rows.length - threshold);
  const visible = expanded || hidden === 0 ? rows : rows.slice(0, threshold);

  return (
    <div
      className={`divide-y divide-black/8 overflow-hidden rounded-row border border-black/12 ${className}`.trim()}
    >
      {visible}
      {hidden > 0 && !expanded ? (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="block w-full px-3.5 py-3 text-left text-[13px] font-medium text-plum transition duration-150 ease-out hover:text-plum-hover"
        >
          Show {hidden} more
        </button>
      ) : null}
    </div>
  );
}
