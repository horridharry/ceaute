import {
  acceptProviderAgreement,
  refreshPaymentStatus,
  startOrResumeOnboarding,
} from "./actions";
import { getPaymentSettings } from "./queries";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Disclosure } from "@/components/ui/disclosure";
import { PendingButton } from "@/components/ui/pending-button";
import { describeRestrictionForProvider } from "@/lib/payments/provider-liability";
import { calculateBookingFeeSplit } from "@/lib/payments/booking-payments";
import { DashboardPage } from "../../_components/dashboard-page";
import { PaymentActions } from "./_components/payment-actions";

const money = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
});

// All of the fee and refund information, kept in full but collapsed: it
// answers questions a provider has occasionally, not every visit.
function FeesAndRefunds() {
  const example = calculateBookingFeeSplit({ amountChargedPence: 5000 });

  return (
    <Disclosure summary="Fees and refunds" className="mt-8">
      <p className="text-ink-muted">Example £50 online payment</p>
      <dl className="grid gap-2 tabular-nums">
        <div className="flex justify-between gap-4">
          <dt>Customer pays</dt>
          <dd className="font-semibold">{money.format(example.amountChargedPence / 100)}</dd>
        </div>
        <div className="flex justify-between gap-4 text-ink-muted">
          <dt>Stripe processing estimate</dt>
          <dd>&minus; {money.format(example.estimatedStripeFeePence / 100)}</dd>
        </div>
        <div className="flex justify-between gap-4 text-ink-muted">
          <dt>Ceaute fee (2%)</dt>
          <dd>&minus; {money.format(example.platformFeePence / 100)}</dd>
        </div>
        <div className="flex justify-between gap-4 border-t border-line pt-2">
          <dt>You receive</dt>
          <dd className="font-semibold">{money.format(example.providerNetPence / 100)}</dd>
        </div>
      </dl>
      <p className="text-xs leading-relaxed text-ink-muted">
        The Stripe estimate uses its UK rate of 1.5% + 20p; other cards can cost
        more. Fees apply only to money paid through Ceaute. There is no monthly
        fee.
      </p>
      <h3 className="font-semibold">Refunds</h3>
      <ul className="flex list-disc flex-col gap-2 pl-5 text-ink-muted">
        <li>Early customer cancellation: full refund; provider cost {money.format(0)}.</li>
        <li>
          Late customer cancellation: your policy decides what you keep; Stripe
          processing is not returned.
        </li>
        <li>Provider cancellation: full customer refund; you cover Stripe processing.</li>
      </ul>
    </Disclosure>
  );
}

function AccountDetails({ paymentAccount, requirements }) {
  return (
    <Disclosure summary="Account details" defaultOpen={requirements.length > 0} className="border-t-0">
      <dl className="grid gap-2">
        <div className="flex justify-between gap-4">
          <dt className="text-ink-muted">Transfers</dt>
          <dd>{paymentAccount.stripe_transfers_status ?? "Unavailable"}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-ink-muted">Payouts</dt>
          <dd>{paymentAccount.payouts_status ?? "Unavailable"}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-ink-muted">Recipient setup</dt>
          <dd>{paymentAccount.recipient_applied ? "Applied" : "Incomplete"}</dd>
        </div>
      </dl>
      {requirements.length ? (
        <div>
          <p className="font-semibold">Required by Stripe</p>
          <ul className="mt-1 list-inside list-disc text-ink-muted">
            {requirements.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </Disclosure>
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
  const requirements = [
    ...(paymentAccount?.requirements_past_due ?? []),
    ...(paymentAccount?.requirements_currently_due ?? []),
  ];
  const status = {
    needs_information: hasAccount
      ? { label: "Action required", tone: "attention" }
      : { label: "Not connected", tone: "neutral" },
    pending_review: { label: "In review", tone: "neutral" },
    ready: { label: "Connected", tone: "live" },
    restricted: { label: "Restricted", tone: "attention" },
  }[state.state] ?? { label: "Unavailable", tone: "neutral" };
  // Stripe's own wording for a provider who has not started is about its
  // mechanism; the provider only needs to know what connecting does.
  const message =
    state.state === "ready"
      ? ""
      : !hasAccount && state.state === "needs_information"
        ? "Connect Stripe to get paid for bookings."
        : state.message;

  return (
    <DashboardPage title="Payments" description="Ceaute pays you through Stripe.">
      {restrictionMessage ? (
        <p
          role="status"
          className="mt-6 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900"
        >
          <strong className="font-semibold">Bookings paused. </strong>
          {restrictionMessage}
        </p>
      ) : null}

      {!configured ? (
        <p className="mt-6 rounded-xl border border-danger-line p-4 text-sm text-danger">
          Stripe is not configured on this environment.
        </p>
      ) : null}

      <Card as="section" aria-labelledby="stripe-status" className="mt-6 flex flex-col gap-3 text-sm">
        <div className="flex items-center justify-between gap-4">
          <h2 id="stripe-status" className="text-base font-semibold">
            Stripe
          </h2>
          <Badge tone={status.tone}>{status.label}</Badge>
        </div>
        {message ? <p className="text-ink-muted">{message}</p> : null}
        <PaymentActions
          configured={configured}
          hasAccount={hasAccount}
          canCreateOnboardingLink={state.canCreateOnboardingLink}
          refreshPaymentStatus={refreshPaymentStatus}
          startOrResumeOnboarding={startOrResumeOnboarding}
        />
      </Card>

      {agreementAcceptedAt ? (
        <p className="mt-5 text-sm text-ink-muted">
          Provider agreement: version {agreementVersion} accepted{" "}
          {new Intl.DateTimeFormat("en-GB", { dateStyle: "long" }).format(
            new Date(agreementAcceptedAt),
          )}
          .
        </p>
      ) : (
        <section aria-labelledby="provider-agreement" className="mt-8 flex flex-col gap-2 text-sm">
          <h2 id="provider-agreement" className="font-semibold">
            Provider agreement
          </h2>
          <p className="text-ink-muted">
            Accept version {agreementVersion} before taking paid bookings. It
            covers payouts, refunds and disputes.
          </p>
          <form action={acceptProviderAgreement}>
            <PendingButton variant="secondary" pendingLabel="Recording…">
              Accept the provider agreement
            </PendingButton>
          </form>
        </section>
      )}

      <FeesAndRefunds />
      {hasAccount ? (
        <AccountDetails paymentAccount={paymentAccount} requirements={requirements} />
      ) : null}
    </DashboardPage>
  );
}
