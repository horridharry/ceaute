// A row of filter pills, one selected at a time.
//
// LinkFilterPills is for a filter kept in the URL (Bookings ?view=, Add-ons
// and Treatment groups ?status=): each pill is a link, the current one carries
// aria-current="page", and the page renders on the server. ToggleFilterPills
// is for a filter that is page state only (the storefront and dashboard
// treatment-group filters): each pill is a pressed/unpressed button.
import Link from "next/link";
import { composeClassName } from "./class-names";
import { FILTER_PILL_ROW, filterPillClassName } from "./filter-pills-classes";

function PillCount({ count }) {
  if (count === undefined || count === null) {
    return null;
  }

  return <span className="font-medium tabular-nums opacity-60">{count}</span>;
}

export function LinkFilterPills({ label, options, value, className = "" }) {
  return (
    <nav aria-label={label} className={composeClassName(FILTER_PILL_ROW, className)}>
      {options.map((option) => {
        const selected = option.key === value;
        return (
          <Link
            key={option.key}
            href={option.href}
            aria-current={selected ? "page" : undefined}
            className={filterPillClassName({ selected })}
          >
            {option.label}
            <PillCount count={option.count} />
          </Link>
        );
      })}
    </nav>
  );
}

export function ToggleFilterPills({ label, options, value, onChange, className = "" }) {
  return (
    <div role="group" aria-label={label} className={composeClassName(FILTER_PILL_ROW, className)}>
      {options.map((option) => {
        const selected = option.key === value;
        return (
          <button
            key={option.key}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(option.key)}
            className={filterPillClassName({ selected })}
          >
            {option.label}
            <PillCount count={option.count} />
          </button>
        );
      })}
    </div>
  );
}
