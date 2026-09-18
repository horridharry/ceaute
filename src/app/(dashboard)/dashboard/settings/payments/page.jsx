import Link from "next/link";
import {
  getPaymentSettings,
  refreshPaymentStatus,
  startOrResumeOnboarding,
} from "./actions";
import { PaymentActions } from "./_components/payment-actions";
import { calculateBookingFeeSplit } from "@/lib/payments/booking-payments";

const money = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
});

// Worked on a round £50 so the two deductions are legible side by side. The
// figures come from the same calculation the checkout uses, so this cannot
// drift away from what a provider is actually paid.
function ProviderPricing() {
  const example = calculateBookingFeeSplit({ amountChargedPence: 5000 });

  return (
    <section className="mt-8 rounded-xl border p-4 text-sm">
      <h2 className="text-lg font-semibold">What you receive</h2>
      <p className="mt-2 text-black/60">
        Customers pay the price you advertise. Two amounts come out of every
        payment Ceaute processes for you, and the rest is transferred to your
        Stripe account.
      </p>
      <dl className="mt-4 grid gap-2">
        <div className="flex justify-between gap-4">
          <dt>Customer pays</dt>
          <dd className="font-semibold">
            {money.format(example.amountChargedPence / 100)}
          </dd>
        </div>
        <div className="flex justify-between gap-4 text-black/60">
          <dt>Card processing, charged by Stripe</dt>
          <dd>&minus; {money.format(example.estimatedStripeFeePence / 100)}</dd>
        </div>
        <div className="flex justify-between gap-4 text-black/60">
          <dt>Ceaute platform fee, 2%</dt>
          <dd>&minus; {money.format(example.platformFeePence / 100)}</dd>
        </div>
        <div className="flex justify-between gap-4 border-t pt-2">
          <dt>You receive</dt>
          <dd className="font-semibold">
            {money.format(example.providerNetPence / 100)}
          </dd>
        </div>
      </dl>
      <p className="mt-4 text-black/60">
        The Ceaute platform fee is 2% of the amount processed. Card processing
        is Stripe&rsquo;s own charge, not Ceaute&rsquo;s: it is shown above at
        Stripe&rsquo;s published UK rate of 1.5% + 20p, and cards issued outside
        the UK or to a business cost more.
      </p>
      <p className="mt-2 text-black/60">
        Both apply only to money taken through Ceaute. Where you take a deposit,
        the balance your customer pays you in person is yours in full &mdash; it
        never passes through Ceaute and is never charged for. There is no
        subscription and no monthly fee.
      </p>

      <h3 className="mt-6 font-semibold">If a booking is refunded</h3>
      <ul className="mt-2 flex list-disc flex-col gap-2 pl-5 text-black/60">
        <li>
          <strong className="text-black">
            A customer cancels inside your cancellation window
          </strong>{" "}
          &mdash; they are refunded in full. You receive nothing and you pay
          nothing: Ceaute returns its platform fee and covers Stripe&rsquo;s
          charge. It costs you {money.format(0)}.
        </li>
        <li>
          <strong className="text-black">A customer cancels late</strong>{" "}
          &mdash; your policy decides what you keep, and the 2% is charged on
          what you actually keep rather than on the original payment. Anything
          collected above that is returned to you. Stripe does not return its
          charge on the original payment, so that stays your cost.
        </li>
        <li>
          <strong className="text-black">You cancel</strong> &mdash; the
          customer is refunded in full and Ceaute returns its platform fee.
          Because the cancellation was yours, Stripe&rsquo;s charge on the
          original payment is your cost.
        </li>
      </ul>
    </section>
  );
}

export default async function DashboardPaymentSettingsPage() {
  const { configured, paymentAccount, state } = await getPaymentSettings();
  const hasAccount = Boolean(paymentAccount?.stripe_account_id);
  const currentlyDue = paymentAccount?.requirements_currently_due ?? [];
  const pastDue = paymentAccount?.requirements_past_due ?? [];
  const titleByState = {
    needs_information: hasAccount ? "Setup incomplete" : "Not connected",
    pending_review: "Stripe is reviewing your information",
    ready: "Payments ready",
    restricted: "Payments restricted",
  };

  return (
    <main className="container max-w-md p-5">
      <div className="mt-6 flex flex-col">
        <Link href="/dashboard/settings" className="text-sm font-semibold text-pink-600">
          Back to settings
        </Link>
        <h1 className="mt-8 text-3xl font-bold tracking-tighter">Payments</h1>
        <p className="mt-1 text-sm text-black/60">
          Connect Stripe Express so Ceaute can route customer payments to you.
        </p>

        {!configured ? (
          <p className="mt-8 rounded-xl border border-red-200 p-4 text-sm text-red-700">
            Stripe is not configured on this environment.
          </p>
        ) : null}

        <section className="mt-8 rounded-xl border p-4 text-sm">
          <h2 className="text-lg font-semibold">
            {titleByState[state.state]}
          </h2>
          <p className="mt-2 text-black/60">{state.message}</p>
          {hasAccount ? (
            <dl className="mt-4 grid gap-2">
              <div className="flex justify-between gap-4">
                <dt>Transfers</dt>
                <dd>{paymentAccount.stripe_transfers_status ?? "Unavailable"}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt>Payouts</dt>
                <dd>{paymentAccount.payouts_status ?? "Unavailable"}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt>Recipient setup</dt>
                <dd>{paymentAccount.recipient_applied ? "Applied" : "Incomplete"}</dd>
              </div>
            </dl>
          ) : null}
          {currentlyDue.length || pastDue.length ? (
            <div className="mt-4 text-black/60">
              <p className="font-semibold text-black">Required by Stripe</p>
              <ul className="mt-2 list-inside list-disc">
                {[...pastDue, ...currentlyDue].map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>

        <ProviderPricing />

        <PaymentActions
          configured={configured}
          hasAccount={hasAccount}
          canCreateOnboardingLink={state.canCreateOnboardingLink}
          refreshPaymentStatus={refreshPaymentStatus}
          startOrResumeOnboarding={startOrResumeOnboarding}
        />
      </div>
    </main>
  );
}
