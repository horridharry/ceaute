import Link from "next/link";
import { PAGE_COLUMN } from "@/components/templates/page-column";

// T2 · Detail — 03-screens.md "The five templates".
//
// Stacked nav → title + meta → body → sections separated by 24px and a
// hairline, each with a heading and an optional "See all" link → commit bar.
// An optional hero sits above the title, and only the provider page has one.
//
// The hero is rendered outside the column so a photograph can run full-bleed;
// everything else stays in the 720px measure.
//
// Routes: provider page, booking detail (both sides).
export function DetailTemplate({
  nav,
  hero,
  title,
  meta,
  commitBar,
  className = "",
  children,
}) {
  return (
    <div className={`flex min-h-screen flex-col ${className}`.trim()}>
      {nav ? <div className={PAGE_COLUMN}>{nav}</div> : null}
      {hero}

      <main className={`${PAGE_COLUMN} flex flex-1 flex-col gap-6 pb-8 pt-4`}>
        <header className="flex flex-col gap-1">
          <h1 className="text-title text-pretty text-ink">{title}</h1>
          {meta ? <p className="text-meta text-black/50">{meta}</p> : null}
        </header>
        {children}
      </main>

      {commitBar}
    </div>
  );
}

// The provider's own words, immediately under the title. Line breaks are
// preserved because she wrote them.
export function DetailBody({ className = "", children }) {
  return (
    <p className={`whitespace-pre-line text-body text-black/80 ${className}`.trim()}>
      {children}
    </p>
  );
}

// One section of the detail. The hairline above it is the separator the
// template promises; pass `divider={false}` for a section that opens the page.
export function DetailSection({
  heading,
  actionLabel,
  actionHref,
  divider = true,
  className = "",
  children,
}) {
  return (
    <section
      className={`flex flex-col gap-3 ${divider ? "border-t border-black/8 pt-6" : ""} ${className}`.trim()}
    >
      {heading ? (
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-heading text-pretty text-ink">{heading}</h2>
          {actionLabel && actionHref ? (
            <Link
              href={actionHref}
              className="shrink-0 text-[13px] font-medium text-plum transition duration-150 ease-out hover:text-plum-hover"
            >
              {actionLabel}
            </Link>
          ) : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}
