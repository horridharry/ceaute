import { LETTER_COLUMN } from "@/components/templates/page-column";

// T5 · Letter — 03-screens.md "The five templates".
//
// Wordmark-only nav → eyebrow label → second-person headline at 30/1.12 → one
// paragraph → one framed panel → a button pair → a quiet text button that
// leaves the page.
//
// The nav is rendered by the template and takes no slot. That is the whole
// point of the component: nothing may sit in the top right, and every exit
// belongs in the bottom third within one-handed reach. A `nav` prop would make
// that constraint an instruction again rather than a guarantee.
//
// The wordmark is plain text rather than a link for the same reason — a link
// there is a top-left exit competing with the ones below.
//
// Routes: Confirmed, Published, Link sent, Cancelled. Nowhere else: the voice
// only works because it is rare.
export function LetterTemplate({
  eyebrow,
  headline,
  panel,
  actions,
  exit,
  className = "",
  children,
}) {
  return (
    <div className={`flex min-h-screen flex-col ${className}`.trim()}>
      <header className={`${LETTER_COLUMN} flex h-[52px] items-center`}>
        <span className="text-[16px] font-semibold tracking-[-0.03em] text-ink">
          Ceaute
        </span>
      </header>

      <main className={`${LETTER_COLUMN} flex flex-1 flex-col gap-5 pb-8 pt-6`}>
        <div className="flex flex-col gap-2.5">
          {eyebrow ? (
            <p className="text-label uppercase text-plum">{eyebrow}</p>
          ) : null}
          <h1 className="text-letter text-pretty text-ink">{headline}</h1>
          {children ? (
            <p className="text-body text-black/80">{children}</p>
          ) : null}
        </div>

        {panel}

        <div className="mt-auto flex flex-col gap-2 pt-6">
          {actions}
          {exit ? <div className="flex justify-center">{exit}</div> : null}
        </div>
      </main>
    </div>
  );
}

// The one framed panel: a photograph and its details, or a link card. Surface
// fill, no border and no shadow — 01-foundations.md gives `surface` to "the
// framed panel inside a letter screen".
export function LetterPanel({ className = "", children }) {
  return (
    <div className={`rounded-panel bg-surface p-4 ${className}`.trim()}>
      {children}
    </div>
  );
}
