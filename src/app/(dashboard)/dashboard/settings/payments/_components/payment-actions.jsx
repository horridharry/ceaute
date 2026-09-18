"use client";

import { useActionState } from "react";

const idleState = { error: false, message: "" };

// Stripe-backed buttons for the payments screen. Both actions can take a few
// seconds and can fail for reasons outside Ceaute, so each one reports its
// pending state immediately and shows the returned outcome in place instead
// of leaving the screen unchanged or crashing the page.
export function PaymentActions({
  configured,
  hasAccount,
  canCreateOnboardingLink,
  refreshPaymentStatus,
  startOrResumeOnboarding,
}) {
  const [refreshState, refreshAction, refreshPending] = useActionState(
    refreshPaymentStatus,
    idleState,
  );
  const [onboardingState, onboardingAction, onboardingPending] = useActionState(
    startOrResumeOnboarding,
    idleState,
  );
  const busy = refreshPending || onboardingPending;
  const outcome = onboardingState.message ? onboardingState : refreshState;

  return (
    <div className="mt-8 flex flex-col items-end gap-3">
      <div className="flex items-center justify-end gap-3">
        {hasAccount ? (
          <form action={refreshAction}>
            <button
              type="submit"
              disabled={!configured || busy}
              aria-disabled={!configured || busy}
              className="rounded-lg border border-black/10 p-3 px-4 text-sm font-semibold text-plum duration-200 hover:border-black/20 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {refreshPending ? "Refreshing..." : "Refresh status"}
            </button>
          </form>
        ) : null}
        {canCreateOnboardingLink ? (
          <form action={onboardingAction}>
            <button
              type="submit"
              disabled={!configured || busy}
              aria-disabled={!configured || busy}
              className="rounded-lg bg-plum p-3 px-4 text-sm font-semibold text-white shadow-sm duration-200 hover:bg-plum-hover disabled:cursor-not-allowed disabled:opacity-50"
            >
              {onboardingPending
                ? "Connecting..."
                : hasAccount
                  ? "Resume onboarding"
                  : "Connect Stripe"}
            </button>
          </form>
        ) : null}
      </div>
      {outcome.message ? (
        <p
          role="status"
          className={
            outcome.error
              ? "rounded-lg border border-bad/35 p-3 text-sm text-bad"
              : "text-sm text-black/60"
          }
        >
          {outcome.message}
        </p>
      ) : null}
    </div>
  );
}
