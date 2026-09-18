import { ButtonLink } from "@/components/ui/button";
import { SummaryCard, SummaryLine } from "@/components/ui/summary-card";

// A6. Stripe's return page only reads state; the webhook confirms. Without a
// screen for that gap a customer lands on an unconfirmed booking and panics.
//
// This screen never claims the booking succeeded. It says a payment was taken
// and that the confirmation is still outstanding, which is exactly what is
// known at this point — the caller only renders it when the booking has not
// been confirmed yet.
//
// The ring is the one spinner in the product that is not inside a committing
// button. 01-foundations.md allows it here by name, because this is a genuine
// wait on a webhook and the screen says so in words.
export function BookingConfirming({
  providerName,
  treatmentName,
  whenLabel,
  amountPaidLabel,
}) {
  return (
    <main className="mx-auto flex w-full max-w-[720px] flex-1 flex-col items-start gap-5 px-5 pb-8 pt-10">
      <span
        aria-hidden="true"
        className="block size-9 animate-spin rounded-full border-[3px] border-plum/25 border-t-plum"
      />

      <div className="flex flex-col gap-2.5">
        <h1 className="text-title text-pretty text-ink">
          Confirming your booking
        </h1>
        <p className="text-body text-black/80" role="status">
          Stripe took your payment. We&rsquo;re waiting for it to confirm the
          time with {providerName} — usually a few seconds.
        </p>
      </div>

      <SummaryCard className="w-full">
        <SummaryLine label={treatmentName} value={whenLabel} />
        <SummaryLine label="Paid" value={amountPaidLabel} total />
      </SummaryCard>

      <p className="text-[12.5px]/[1.55] text-black/60">
        Safe to close this — the confirmation and receipt arrive by email either
        way.
      </p>

      <ButtonLink href="/account/bookings" variant="tertiary">
        Go to my bookings
      </ButtonLink>
    </main>
  );
}
