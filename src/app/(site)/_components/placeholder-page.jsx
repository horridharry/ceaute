import Link from "next/link";

// Temporary destination for the Help, Privacy and Terms links shown during
// authentication. These exist so the links resolve; the real support and
// legal content is written before live launch and replaces this component.
export function PlaceholderPage({ title, summary, children }) {
  return (
    <main className="container max-w-md p-5 bg-white">
      <div className="mt-6 flex flex-col">
        <h1 className="text-3xl font-bold tracking-tighter">{title}</h1>
        <p className="mt-1 text-sm text-black/60">{summary}</p>

        <div className="mt-8 rounded-xl border border-dashed p-4 text-sm">
          <p className="font-semibold text-pink-600">Placeholder page</p>
          <div className="mt-2 flex flex-col gap-2 text-black/70">{children}</div>
        </div>

        <Link
          href="/"
          className="mt-8 w-max text-sm font-semibold text-pink-600 duration-200 hover:text-pink-700"
        >
          Back to Ceaute
        </Link>
      </div>
    </main>
  );
}
