// The parts of a booking the customer checks before paying, shared by Review
// and pay and the held page so both describe it in the same words. Values
// arrive formatted: the pages turn the SQL quote or the booking snapshot into
// text with src/lib/bookings/booking-money.js.
import { Disclosure } from "@/components/ui/disclosure";

// The bar with the page's one action: stuck to the bottom of the screen on
// phones (above the home indicator), in the page flow from 640px. Its parent
// must span the page content, or it has nowhere to stick.
export const PAY_BAR =
  "sticky bottom-0 z-10 -mx-5 mt-8 border-t border-line bg-surface px-5 pb-[calc(12px+env(safe-area-inset-bottom,0px))] pt-3 sm:static sm:mx-0 sm:border-0 sm:p-0";

export function PayNow({ amount }) {
  return (
    <p className="flex flex-col tabular-nums">
      <span className="text-xs text-ink-muted">Pay now</span>
      <span className="text-base font-semibold">{amount}</span>
    </p>
  );
}

export function BookingSummaryCard({ provider, appointment, lines }) {
  return (
    <section aria-label="Your booking" className="flex flex-col gap-3 rounded-xl border border-line p-4">
      <div>
        <p className="font-semibold">{provider.name}</p>
        {provider.publicArea ? <p className="text-sm text-ink-muted">{provider.publicArea}</p> : null}
      </div>
      <div>
        <p className="font-semibold">{appointment.when}</p>
        <p className="text-sm text-ink-muted">{appointment.duration}</p>
      </div>
      <dl className="flex flex-col text-sm tabular-nums">
        {lines.map((line) => (
          <div key={line.key} className="flex justify-between gap-3 py-1.5">
            <dt className={line.addOn ? "text-ink-muted" : ""}>{line.addOn ? `+ ${line.label}` : line.label}</dt>
            <dd>{line.price}</dd>
          </div>
        ))}
        <div className="mt-1 flex justify-between gap-3 border-t border-line pt-2.5 font-semibold">
          <dt>Total</dt>
          <dd>{appointment.total}</dd>
        </div>
      </dl>
    </section>
  );
}

export function PaymentBlock({ money, providerName }) {
  return (
    <section aria-labelledby="payment-heading">
      <h2 id="payment-heading" className="text-lg font-semibold tracking-tight">
        Payment
      </h2>
      <div className="mt-3 rounded-xl bg-surface-subtle p-4 tabular-nums">
        <p className="flex justify-between gap-3 text-base font-semibold">
          <span>{money.payNowLabel}</span>
          <span>{money.dueNow}</span>
        </p>
        {money.dueLater ? (
          <p className="mt-1 flex justify-between gap-3 text-sm text-ink-muted">
            <span>Pay {providerName} at the appointment</span>
            <span>{money.dueLater}</span>
          </p>
        ) : null}
        {money.minimumApplied ? (
          <p className="mt-2 text-[13px] text-ink-muted">Deposits are at least £1.00.</p>
        ) : null}
      </div>
    </section>
  );
}

export function CancellationBlock({ cancellation, providerName }) {
  return (
    <section aria-labelledby="cancellation-heading">
      <h2 id="cancellation-heading" className="text-lg font-semibold tracking-tight">
        Cancellation
      </h2>
      {cancellation.summary ? (
        <p className="mt-2 text-sm">
          Free cancellation until <strong>{cancellation.deadline}</strong>, {cancellation.windowHours} hours
          before. After that, {cancellation.summary} If {providerName} cancels, you get everything back.
        </p>
      ) : null}
      {cancellation.policy ? (
        <Disclosure summary={`${providerName}’s booking policy`} className="mt-3">
          <p className="whitespace-pre-line">{cancellation.policy}</p>
        </Disclosure>
      ) : null}
      <p className="mt-3 text-sm text-ink-muted">The exact address is shared once your booking is confirmed.</p>
    </section>
  );
}
