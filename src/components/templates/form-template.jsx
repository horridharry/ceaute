import { PAGE_COLUMN } from "@/components/templates/page-column";

// T3 · Form — 03-screens.md "The five templates".
//
// Modal nav → fields in one column 13px apart → optional notice → commit bar
// carrying the single primary.
//
// The template is the <form> itself, so the nav's Save and the commit bar's
// primary are the same submission rather than two controls that have to be
// kept in step. Pass `action` (a server action) or `onSubmit` straight
// through.
//
// Pairs sit side by side only for price + duration and city + postcode; use
// <FieldPair> for those and let everything else stack.
//
// Routes: every create/edit screen, Review & pay, sign in, sign up,
// onboarding, booking terms, location.
export function FormTemplate({
  nav,
  notice,
  commitBar,
  className = "",
  children,
  ...formProps
}) {
  return (
    <form {...formProps} className={`flex min-h-screen flex-col ${className}`.trim()}>
      {nav ? <div className={PAGE_COLUMN}>{nav}</div> : null}

      <main className={`${PAGE_COLUMN} flex-1 pb-8 pt-4`}>
        {/* The fields sit in their own column rather than directly in <main>.
            `.field-set` carries flex-1 so a pair can share a row, and in a
            flex-column main that is stretched by flex-1 every field would
            grow to fill the page instead of standing 13px apart. */}
        <div className="flex flex-col gap-[13px]">{children}</div>
        {notice ? <div className="pt-4">{notice}</div> : null}
      </main>

      {commitBar}
    </form>
  );
}
