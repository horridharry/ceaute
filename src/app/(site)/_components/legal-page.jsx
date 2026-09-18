import Link from "next/link";

// Shared shell for /terms and /privacy. The operator details both pages need
// come from src/lib/legal/identity.js, and the build gate in
// scripts/assert-legal-identity.mjs stops a Production publication while any
// of them is still a placeholder — so this shell no longer carries a draft
// banner of its own. See docs/reports/2026-09-18-legal-pages-review-note.md
// for what remains unresolved.
export function LegalPage({ title, summary, updated, children }) {
  return (
    <main className="container max-w-2xl mx-auto p-5 pb-16 bg-white">
      <div className="mt-6 flex flex-col">
        <h1 className="text-3xl font-bold tracking-tighter">{title}</h1>
        <p className="mt-1 text-sm text-black/60">{summary}</p>
        <p className="mt-1 text-xs text-black/40">Last updated {updated}</p>

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
