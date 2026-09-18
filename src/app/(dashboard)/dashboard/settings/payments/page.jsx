import {
  DetailSection,
  DetailTemplate,
} from "@/components/templates/detail-template";
import { ProblemNotice } from "@/components/ui/notice";
import { StatusDot } from "@/components/ui/status";
import { SummaryCard, SummaryLine } from "@/components/ui/summary-card";
import { StackedTopBar } from "@/components/ui/top-bar";
import {
  getPaymentSettings,
  refreshPaymentStatus,
  startOrResumeOnboarding,
} from "./actions";
import { PaymentActions } from "./_components/payment-actions";

// The five states classifyStripePaymentAccount can return, each with the tone
// the status dot should use. Amber is the only place "pending" appears in the
// dashboard: Stripe is working on it and nothing has gone wrong.
const TONE_BY_STATE = {
  needs_information: "pending",
  pending_review: "pending",
  ready: "ok",
  restricted: "bad",
};

export default async function DashboardPaymentSettingsPage() {
  const { configured, paymentAccount, state } = await getPaymentSettings();
  const hasAccount = Boolean(paymentAccount?.stripe_account_id);
  const currentlyDue = paymentAccount?.requirements_currently_due ?? [];
  const pastDue = paymentAccount?.requirements_past_due ?? [];
  const titleByState = {
    needs_information: hasAccount ? "Setup incomplete" : "Not connected",
    pending_review: "Stripe is reviewing",
    ready: "Payments ready",
    restricted: "Restricted — fix in Stripe",
  };

  return (
    <DetailTemplate
      nav={<StackedTopBar backHref="/dashboard/settings" backLabel="Settings" />}
      title="Payments"
      meta="Customer payments go straight to your Stripe account. Ceaute's fee is currently £0."
    >
      {!configured ? (
        <ProblemNotice title="Stripe is not configured on this environment">
          Nothing here can connect until it is.
        </ProblemNotice>
      ) : null}

      <div className="flex flex-col gap-3">
        <StatusDot
          tone={hasAccount ? (TONE_BY_STATE[state.state] ?? "muted") : "muted"}
          label={titleByState[state.state] ?? "Not connected"}
        />
        <p className="text-body text-black/80">{state.message}</p>

        <PaymentActions
          configured={configured}
          hasAccount={hasAccount}
          canCreateOnboardingLink={state.canCreateOnboardingLink}
          refreshPaymentStatus={refreshPaymentStatus}
          startOrResumeOnboarding={startOrResumeOnboarding}
        />
      </div>

      {hasAccount ? (
        <DetailSection heading="What Stripe says">
          <SummaryCard>
            <SummaryLine
              label="Transfers"
              value={paymentAccount.stripe_transfers_status ?? "Unavailable"}
            />
            <SummaryLine
              label="Payouts"
              value={paymentAccount.payouts_status ?? "Unavailable"}
            />
            <SummaryLine
              label="Recipient setup"
              value={paymentAccount.recipient_applied ? "Applied" : "Incomplete"}
              total
            />
          </SummaryCard>
        </DetailSection>
      ) : null}

      {currentlyDue.length || pastDue.length ? (
        <DetailSection heading="Required by Stripe">
          <ul className="flex flex-col gap-1.5">
            {[...pastDue, ...currentlyDue].map((item) => (
              <li key={item} className="flex items-start gap-2.5">
                <span
                  aria-hidden="true"
                  className="mt-[7px] block size-[7px] shrink-0 rounded-full bg-pending"
                />
                <span className="text-body text-black/80">{item}</span>
              </li>
            ))}
          </ul>
          <p className="text-[12.5px] text-black/60">
            Your page cannot publish until Stripe has these.
          </p>
        </DetailSection>
      ) : null}
    </DetailTemplate>
  );
}
