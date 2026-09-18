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
              className="inline-flex h-12 select-none items-center justify-center rounded-control border border-black/16 px-6 text-body-strong text-ink transition duration-150 ease-out hover:border-black/30 disabled:pointer-events-none disabled:opacity-40"
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
              className="inline-flex h-12 select-none items-center justify-center rounded-control bg-plum px-6 text-body-strong font-semibold text-white transition duration-150 ease-out hover:bg-plum-hover disabled:pointer-events-none disabled:opacity-40"
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
              ? "border-y border-black/8 py-3 text-[12.5px]/[1.55] text-bad"
              : "text-[12.5px] text-black/60"
          }
        >
          {outcome.message}
        </p>
      ) : null}
    </div>
  );
}
