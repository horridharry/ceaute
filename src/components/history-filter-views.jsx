"use client";

// Filter pills that switch between views already on the page, instantly
// (approved 23 September 2026 for Bookings and My bookings). The server
// renders every view once; choosing a pill shows its view and records the
// choice as a real browser history entry (window.history.pushState, which
// Next keeps in sync with useSearchParams). So the URL stays shareable, Back
// restores the previous view, Forward re-applies it, and a reload or a shared
// link opens the same view from the server. Choosing the view already shown
// adds nothing to history.
//
// Each pill is a real link, so opening it in a new tab still works.
import { useSearchParams } from "next/navigation";
import { composeClassName } from "./ui/class-names";
import { FILTER_PILL_ROW, filterPillClassName } from "./ui/filter-pills-classes";

// The view a URL asks for: its own key when it names one, the default when it
// names none, and otherwise the view the server resolved for the page it
// rendered (an older alias such as ?view=previous).
export function viewFromSearch(value, { keys, defaultKey, serverKey }) {
  if (!value) return defaultKey;
  return keys.includes(value) ? value : serverKey;
}

function isPlainClick(event) {
  return event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;
}

export function HistoryFilterViews({
  label,
  param = "view",
  options,
  defaultKey,
  serverKey,
  panels,
  className = "",
}) {
  const searchParams = useSearchParams();
  const keys = options.map((option) => option.key);
  const current = viewFromSearch(searchParams.get(param), { keys, defaultKey, serverKey });

  return (
    <>
      <nav aria-label={label} className={composeClassName(FILTER_PILL_ROW, className)}>
        {options.map((option) => {
          const selected = option.key === current;
          return (
            <a
              key={option.key}
              href={option.href}
              aria-current={selected ? "page" : undefined}
              onClick={(event) => {
                if (!isPlainClick(event)) return;
                event.preventDefault();
                if (!selected) {
                  window.history.pushState(null, "", option.href);
                }
              }}
              className={filterPillClassName({ selected })}
            >
              {option.label}
              {option.count === undefined || option.count === null ? null : (
                <span className="font-medium tabular-nums opacity-60">{option.count}</span>
              )}
            </a>
          );
        })}
      </nav>
      {options.map((option) => (
        <div key={option.key} hidden={option.key !== current}>
          {panels[option.key]}
        </div>
      ))}
    </>
  );
}
