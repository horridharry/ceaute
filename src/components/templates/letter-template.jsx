import { LETTER_COLUMN } from "@/components/templates/page-column";

// T5 · Letter — 03-screens.md "The five templates".
//
// Eyebrow label → second-person headline at 30/1.12 → one paragraph → one
// framed panel → a button pair → a quiet text button that leaves the page.
//
// The template takes no `nav` slot, so no caller can put an exit at the top:
// every exit belongs in the bottom third within one-handed reach.
//
// It draws no wordmark of its own either. Every route that uses this template
// sits under a layout that already renders AppHeader, so drawing one here put
// the wordmark on screen twice. The header's avatar is the one thing allowed
// in the top right (05-build-order.md, review checklist).
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
