import { PAGE_COLUMN } from "@/components/templates/page-column";

// T4 · Picker — 03-screens.md "The five templates".
//
// Stacked nav → held row, once a hold exists → title → the month header and
// five-day strip → the day name → the slot grid → commit bar showing the
// chosen time.
//
// The ordered parts are named slots rather than children, because the order is
// the template: the held row has to sit above the title, and the day name has
// to sit between the strip and the grid. `dayStrip` takes a <DayStrip>, which
// carries its own month header and prev/next controls.
//
// `children` is the grid — a <SlotGrid> when a customer is picking a time, or
// rows when a provider is setting her working hours.
//
// Routes: pick a time; provider availability.
export function PickerTemplate({
  nav,
  heldRow,
  title,
  subtitle,
  dayStrip,
  dayLabel,
  commitBar,
  className = "",
  children,
}) {
  return (
    <div className={`flex min-h-screen flex-col ${className}`.trim()}>
      {nav ? <div className={PAGE_COLUMN}>{nav}</div> : null}
      {heldRow ? <div className={PAGE_COLUMN}>{heldRow}</div> : null}

      <main className={`${PAGE_COLUMN} flex flex-1 flex-col gap-5 pb-8 pt-4`}>
        <header className="flex flex-col gap-1">
          <h1 className="text-display text-pretty text-ink">{title}</h1>
          {subtitle ? (
            <p className="text-meta text-black/50">{subtitle}</p>
          ) : null}
        </header>

        {dayStrip}

        <div className="flex flex-col gap-3">
          {dayLabel ? (
            <h2 className="text-heading text-pretty text-ink">{dayLabel}</h2>
          ) : null}
          {children}
        </div>
      </main>

      {commitBar}
    </div>
  );
}
