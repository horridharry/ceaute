import {
  acceptProviderAgreement,
  getPaymentSettings,
  refreshPaymentStatus,
  startOrResumeOnboarding,
} from "./actions";
import { PendingButton } from "@/components/pending-button";
import { describeRestrictionForProvider } from "@/lib/payments/provider-liability";
import { PaymentActions } from "./_components/payment-actions";
import { calculateBookingFeeSplit } from "@/lib/payments/booking-payments";
import { SettingsSectionNav } from "../../_components/settings-section-nav";
import { StatusBadge } from "../../_components/status-badge";

const money = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
});

function ProviderPricing() {
  const example = calculateBookingFeeSplit({ amountChargedPence: 5000 });

  return (
    <section className="mt-8 rounded-xl border border-black/10 p-4 text-sm">
      <h2 className="text-lg font-semibold">Fees</h2>
      <p className="mt-1 text-black/55">Example £50 online payment</p>
      <dl className="mt-4 grid gap-2">
        <div className="flex justify-between gap-4">
          <dt>Customer pays</dt>
          <dd className="font-semibold">
            {money.format(example.amountChargedPence / 100)}
          </dd>
        </div>
        <div className="flex justify-between gap-4 text-black/60">
          <dt>Stripe processing estimate</dt>
          <dd>
            &minus; {money.format(example.estimatedStripeFeePence / 100)}
          </dd>
        </div>
        <div className="flex justify-between gap-4 text-black/60">
          <dt>Ceaute fee (2%)</dt>
          <dd>&minus; {money.format(example.platformFeePence / 100)}</dd>
        </div>
        <div className="flex justify-between gap-4 border-t pt-2">
          <dt>You receive</dt>
          <dd className="font-semibold">
            {money.format(example.providerNetPence / 100)}
          </dd>
        </div>
      </dl>
      <p className="mt-4 text-xs leading-relaxed text-black/55">
        The Stripe estimate uses its UK rate of 1.5% + 20p; other cards can cost
        more. Fees apply only to money paid through Ceaute. There is no monthly
        fee.
      </p>

      <h3 className="mt-6 font-semibold">Refunds</h3>
      <ul className="mt-2 flex list-disc flex-col gap-2 pl-5 text-black/60">
        <li>
          Early customer cancellation: full refund; provider cost{" "}
          {money.format(0)}.
        </li>
        <li>
          Late customer cancellation: your policy decides what you keep; Stripe
          processing is not returned.
        </li>
        <li>
          Provider cancellation: full customer refund; you cover Stripe
          processing.
        </li>
      </ul>
    </section>
  );
}

export default async function DashboardPaymentSettingsPage() {
  const {
    configured,
    paymentAccount,
    state,
    agreementVersion,
    agreementAcceptedAt,
    restriction,
  } = await getPaymentSettings();
  const restrictionMessage = describeRestrictionForProvider(restriction);
  const hasAccount = Boolean(paymentAccount?.stripe_account_id);
  const currentlyDue = paymentAccount?.requirements_currently_due ?? [];
  const pastDue = paymentAccount?.requirements_past_due ?? [];
  const toneByState = {
    needs_information: "warn",
    pending_review: "warn",
    ready: "good",
    restricted: "bad",
  };
  const labelByState = {
    needs_information: hasAccount ? "Action required" : "Not connected",
    pending_review: "In review",
    ready: "Connected",
    restricted: "Restricted",
  };

  return (
    <main className="container max-w-md p-5">
      <div className="mt-6 flex flex-col">
        <SettingsSectionNav />
        <h2 className="mt-8 text-2xl font-semibold tracking-tighter">
          Payments
        </h2>

        {restrictionMessage ? (
          <p
            role="status"
            className="mt-8 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900"
          >
            <strong className="font-semibold">Bookings paused. </strong>
            {restrictionMessage}
          </p>
        ) : null}

        <section className="mt-8 rounded-xl border border-black/10 p-4 text-sm">
          <h2 className="text-lg font-semibold">Provider agreement</h2>
          {agreementAcceptedAt ? (
            <p className="mt-2 text-black/60">
              Version {agreementVersion} accepted{" "}
              {new Intl.DateTimeFormat("en-GB", {
                dateStyle: "long",
              }).format(new Date(agreementAcceptedAt))}
              .
            </p>
          ) : (
            <>
              <p className="mt-2 text-black/60">
                Accept version {agreementVersion} before taking paid bookings.
                It covers payouts, refunds and disputes.
              </p>
              <form action={acceptProviderAgreement} className="mt-4">
                <PendingButton
                  pendingLabel="Recording..."
                  className="w-max rounded-lg bg-accent-700 p-3 px-4 text-sm font-semibold text-white shadow-sm duration-200 hover:bg-accent-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Accept the provider agreement
                </PendingButton>
              </form>
            </>
          )}
        </section>

        {!configured ? (
          <p className="mt-8 rounded-xl border border-red-200 p-4 text-sm text-red-700">
            Stripe is not configured on this environment.
          </p>
        ) : null}

        <section className="mt-8 rounded-xl border border-black/10 p-4 text-sm">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-lg font-semibold">Stripe</h2>
            <StatusBadge tone={toneByState[state.state]}>
              {labelByState[state.state]}
            </StatusBadge>
          </div>
          {state.state === "ready" ? null : (
            <p className="mt-3 text-black/60">{state.message}</p>
          )}
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
