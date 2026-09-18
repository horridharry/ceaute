import Link from "next/link";

// Shared shell for /terms, /privacy and /help. Terms and Privacy pass
// `draft`, which renders a visible notice plus any <Todo> callouts in their
// content — required because those two pages describe unresolved business
// and legal decisions (see AGENTS.md's legal quality gate) that must stay
// clearly flagged rather than look like approved, final text.
export function LegalPage({ title, summary, updated, draft = false, children }) {
  return (
    <main className="container max-w-2xl mx-auto p-5 pb-16 bg-white">
      <div className="mt-6 flex flex-col">
        <h1 className="text-3xl font-bold tracking-tighter">{title}</h1>
        <p className="mt-1 text-sm text-black/60">{summary}</p>
        <p className="mt-1 text-xs text-black/40">Last updated {updated}</p>

        {draft && (
          <div className="mt-6 rounded-xl border border-dashed border-pink-300 bg-pink-50 p-4 text-sm">
            <p className="font-semibold text-pink-600">Draft for owner review</p>
            <p className="mt-1 text-black/70">
              This page describes how Ceaute actually operates today. It has
              not yet been approved as final by Ceaute&rsquo;s owner or
              reviewed by a lawyer. Anything marked &ldquo;Owner TODO&rdquo;
              below is an open question, not a term you can rely on.
            </p>
          </div>
        )}

        <div className="legal-prose mt-8 flex flex-col gap-8">{children}</div>

        <Link
          href="/"
          className="mt-10 w-max text-sm font-semibold text-pink-600 duration-200 hover:text-pink-700"
        >
          Back to Ceaute
        </Link>
      </div>
    </main>
  );
}

export function Todo({ children }) {
  return (
    <p className="mt-3 rounded-lg border border-dashed border-amber-300 bg-amber-50 p-3 text-xs text-amber-800">
      <span className="font-semibold">Owner TODO — </span>
      {children}
    </p>
  );
}
