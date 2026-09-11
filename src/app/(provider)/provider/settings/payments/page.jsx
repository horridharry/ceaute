import Link from "next/link";
import {
  getPaymentSettings,
  refreshPaymentStatus,
  startOrResumeOnboarding,
} from "./actions";

export default async function ProviderPaymentsPage() {
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
        <Link href="/provider/settings" className="text-sm font-semibold text-pink-600">
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

        <div className="mt-8 flex items-center justify-end gap-3">
          {hasAccount ? (
            <form action={refreshPaymentStatus}>
              <button
                type="submit"
                disabled={!configured}
                className="rounded-lg border border-black/10 p-3 px-4 text-sm font-semibold text-pink-600 duration-200 hover:border-black/20 disabled:opacity-50"
              >
                Refresh status
              </button>
            </form>
          ) : null}
          {state.canCreateOnboardingLink ? (
            <form action={startOrResumeOnboarding}>
              <button
                type="submit"
                disabled={!configured}
                className="rounded-lg bg-pink-700 p-3 px-4 text-sm font-semibold text-white shadow-sm duration-200 hover:bg-pink-800 disabled:opacity-50"
              >
                {hasAccount ? "Resume onboarding" : "Connect Stripe"}
              </button>
            </form>
          ) : null}
        </div>
      </div>
    </main>
  );
}
