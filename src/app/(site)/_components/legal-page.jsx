import Link from "next/link";

// Shared shell for /terms and /privacy. Both pass `draft`, which renders a
// visible notice naming the two facts Ceaute has not yet established: the
// legal entity operating the service and a monitored contact address. Until
// the owner settles those, the pages must not read as approved final policies
// — and neither the entity nor the address may be invented to remove the
// notice. See docs/reports/2026-09-18-legal-pages-review-note.md.
export function LegalPage({ title, summary, updated, draft = false, children }) {
  return (
    <main className="container max-w-2xl mx-auto p-5 pb-16 bg-white">
      <div className="mt-6 flex flex-col">
        <h1 className="text-3xl font-bold tracking-tighter">{title}</h1>
        <p className="mt-1 text-sm text-black/60">{summary}</p>
        <p className="mt-1 text-xs text-black/40">Last updated {updated}</p>

        {draft && (
          <div className="mt-6 rounded-xl border border-dashed border-pink-300 bg-pink-50 p-4 text-sm">
            <p className="font-semibold text-pink-600">
              Not yet final — private alpha
            </p>
            <p className="mt-1 text-black/70">
              This page describes how Ceaute actually works today, but it is
              not a finished policy. Two things are still missing: the legal
              entity that operates Ceaute has not been established, and there
              is no published contact address for support, complaints or data
              protection requests. During the private alpha, use the email
              address the Ceaute team gave you when you were invited.
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
