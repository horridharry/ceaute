"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";

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
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        {canCreateOnboardingLink ? (
          <form action={onboardingAction}>
            <Button type="submit" disabled={!configured || busy} aria-busy={onboardingPending || undefined}>
              {onboardingPending
                ? "Connecting…"
                : hasAccount
                  ? "Continue setup"
                  : "Connect Stripe"}
            </Button>
          </form>
        ) : null}
        {hasAccount ? (
          <form action={refreshAction}>
            <Button
              type="submit"
              variant="text"
              className="px-2"
              disabled={!configured || busy}
              aria-busy={refreshPending || undefined}
            >
              {refreshPending ? "Refreshing…" : "Refresh status"}
            </Button>
          </form>
        ) : null}
      </div>
      {outcome.message ? (
        <p
          role={outcome.error ? "alert" : "status"}
          className={outcome.error ? "text-sm text-danger" : "text-sm text-ink-muted"}
        >
          {outcome.message}
        </p>
      ) : null}
    </div>
  );
}
