import Link from "next/link";

// Shared shell for /terms and /privacy. Both pass `draft`, which renders a
// visible notice naming what Ceaute has still not published: the operator's
// full legal name and a business address. The operator and contact email are
// now settled (sole trader, 18 September 2026); the address disclosures
// required of a sole trader trading under a business name are not. Until they
// are, the pages must not read as approved final policies — and no address
// may be invented to remove the notice. See
// docs/reports/2026-09-18-legal-pages-review-note.md.
export function LegalPage({ title, summary, updated, draft = false, children }) {
  return (
    <main className="container max-w-2xl mx-auto p-5 pb-16 bg-white">
      <div className="mt-6 flex flex-col">
        <h1 className="text-3xl font-bold tracking-tighter">{title}</h1>
        <p className="mt-1 text-sm text-black/60">{summary}</p>
        <p className="mt-1 text-xs text-black/40">Last updated {updated}</p>

        {draft && (
          <div className="mt-6 rounded-xl border border-dashed border-pending/55 p-4 text-sm">
            <p className="font-semibold text-[#7a5410]">
              Not yet final — business address outstanding
            </p>
            <p className="mt-1 text-black/70">
              This page describes how Ceaute actually works today, but it is
              not a finished policy. Ceaute is run by a sole trader who has
              not yet published a business address or a full legal name, both
              of which the law requires of a business trading online under a
              trading name. Everything else here is accurate, and you can
              reach Ceaute at{" "}
              <a
                href="mailto:ndu.harry02@gmail.com"
                className="font-semibold underline"
              >
                ndu.harry02@gmail.com
              </a>
              .
            </p>
          </div>
        )}

        <div className="legal-prose mt-8 flex flex-col gap-8">{children}</div>

        <Link
          href="/"
          className="mt-10 w-max text-sm font-semibold text-plum duration-200 hover:text-plum-hover"
        >
          Back to Ceaute
        </Link>
      </div>
    </main>
  );
}
