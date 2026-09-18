import Link from "next/link";

// The three auth screens share one card: wordmark, title, one sentence, the
// form, and the legal links. The wordmark points at /discover rather than "/"
// so it does not bounce a signed-out visitor through the root redirect.
export function AuthCard({ title, children, footer }) {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-[420px] flex-col justify-center px-5 py-10">
      <div className="flex flex-col rounded-modal border border-black/12 bg-white p-7">
        <Link
          href="/discover"
          className="w-max text-[16px] font-semibold tracking-[-0.03em] text-ink"
        >
          Ceaute
        </Link>

        <h1 className="mt-7 text-title text-pretty text-ink">{title}</h1>
        {children}
      </div>

      <div className="mt-5 flex items-center justify-center gap-5">
        <Link
          href="/privacy"
          className="text-[12px] text-black/45 transition duration-150 ease-out hover:text-ink"
        >
          Privacy
        </Link>
        <Link
          href="/terms"
          className="text-[12px] text-black/45 transition duration-150 ease-out hover:text-ink"
        >
          Terms
        </Link>
      </div>
      {footer}
    </main>
  );
}
