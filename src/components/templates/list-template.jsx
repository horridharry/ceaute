import { PAGE_COLUMN } from "@/components/templates/page-column";

// T1 · List — 03-screens.md "The five templates".
//
// Title → optional search / tabs / chips → a stack of ONE card or row kind,
// 8px apart, with group labels between.
//
// There is deliberately no commit bar slot: a list screen never commits
// anything, and the constraint is easier to keep when the template cannot
// express it.
//
// Routes: Discover, customer Bookings, provider Today and Bookings,
// /@user/treatments, dashboard Treatments, Add-ons, Reviews.
export function ListTemplate({ title, meta, filters, className = "", children }) {
  return (
    <main className={`${PAGE_COLUMN} flex flex-col gap-4 py-6 ${className}`.trim()}>
      <header className="flex flex-col gap-1">
        <h1 className="text-display text-pretty text-ink">{title}</h1>
        {meta ? <p className="text-meta text-black/50">{meta}</p> : null}
      </header>

      {filters ? <div className="flex flex-col gap-3">{filters}</div> : null}

      <div className="flex flex-col gap-2">{children}</div>
    </main>
  );
}

// A labelled run of rows inside the stack. `sticky` is for the grouped
// treatments list, where the group name has to stay legible through a long
// scroll.
export function ListGroup({ label, sticky = false, className = "", children }) {
  return (
    <section className={`flex flex-col gap-2 ${className}`.trim()}>
      {label ? (
        <h2
          className={`text-label uppercase text-black/45 ${
            sticky ? "sticky top-0 z-10 -mx-5 bg-white px-5 py-2" : ""
          }`}
        >
          {label}
        </h2>
      ) : null}
      <div className="flex flex-col gap-2">{children}</div>
    </section>
  );
}
