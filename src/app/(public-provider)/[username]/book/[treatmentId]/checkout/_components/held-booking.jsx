// The held page: where Stripe sends the customer back, and where a hold can
// be finished later (Specification §9.5). What it says comes from
// heldBookingState; it never confirms anything and never offers to pay once
// money has been taken.
import Link from "next/link";
import { buttonClassName } from "@/components/ui/button-classes";
import { PageContainer } from "@/components/ui/page-container";
import { PageHeading } from "@/components/ui/page-heading";
import { PendingButton } from "@/components/ui/pending-button";
import { resumeCheckout } from "../../../actions";
import { BookingSummaryCard, CancellationBlock, PaymentBlock } from "./booking-summary";
import { CheckoutFinePrint } from "./checkout-fine-print";
import { ConfirmingPoller } from "./confirming-poller";

const MY_BOOKINGS_HREF = "/account/bookings";

function NextSteps({ state, links }) {
  switch (state.kind) {
    case "late_payment":
      return (
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href={links.chooseTime} className={buttonClassName({ variant: "primary" })}>
            Choose a new time
          </Link>
          <Link href={MY_BOOKINGS_HREF} className={buttonClassName({ variant: "secondary" })}>
            My bookings
          </Link>
        </div>
      );
    case "expired":
      return (
        <div className="mt-8">
          <Link href={links.chooseTime} className={buttonClassName({ variant: "primary" })}>
            Choose a time
          </Link>
        </div>
      );
    case "unavailable":
      return (
        <div className="mt-8">
          <Link href="/discover" className={buttonClassName({ variant: "primary" })}>
            Discover providers
          </Link>
        </div>
      );
    case "processing":
      return (
        <div className="mt-8">
          <Link href={MY_BOOKINGS_HREF} className={buttonClassName({ variant: "primary" })}>
            Go to My bookings
          </Link>
        </div>
      );
    default:
      return null;
  }
}

export function HeldBooking({
  state,
  copy,
  provider,
  appointment,
  lines,
  money,
  cancellation,
  bookingId,
  links,
}) {
  return (
    <PageContainer>
      <PageHeading back={{ href: links.storefront, label: provider.name }} title={copy.title} />
      <p className="mt-2 text-sm text-ink-muted">{copy.message}</p>

      {state.kind === "confirming" ? <ConfirmingPoller /> : null}

      <div className="mt-6">
        <BookingSummaryCard provider={provider} appointment={appointment} lines={lines} />
      </div>

      {state.canPay ? (
        <>
          <div className="mt-8">
            <PaymentBlock money={money} providerName={provider.name} />
          </div>
          <div className="mt-8">
            <CancellationBlock cancellation={cancellation} providerName={provider.name} />
          </div>

          <form action={resumeCheckout} className="mt-8">
            <input type="hidden" name="booking_id" value={bookingId} />
            <div className="sticky bottom-0 -mx-5 border-t border-line bg-surface px-5 pb-[calc(12px+env(safe-area-inset-bottom,0px))] pt-3 sm:static sm:mx-0 sm:border-0 sm:p-0">
              <div className="flex items-center justify-between gap-3">
                <p className="flex flex-col tabular-nums">
                  <span className="text-xs text-ink-muted">Pay now</span>
                  <span className="text-base font-semibold">{money.dueNow}</span>
                </p>
                <PendingButton pendingLabel="Opening payment…">Continue to payment</PendingButton>
              </div>
            </div>
          </form>
          <p className="mt-3">
            <Link href={links.chooseTime} className={buttonClassName({ variant: "text" })}>
              Choose another time
            </Link>
          </p>
          <CheckoutFinePrint className="mt-2" />
        </>
      ) : (
        <NextSteps state={state} links={links} />
      )}
    </PageContainer>
  );
}
