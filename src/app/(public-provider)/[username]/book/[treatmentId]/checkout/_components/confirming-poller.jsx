"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { buttonClassName } from "@/components/ui/button-classes";

const INTERVAL_MS = 3_000;
const GIVE_UP_AFTER_MS = 60_000;

// After Stripe says the payment went through, ask the server again every
// three seconds. The page re-renders from the database, and once the webhook
// has confirmed the booking the server sends the customer to the
// confirmation. It reads state only; it never confirms anything itself.
export function ConfirmingPoller() {
  const router = useRouter();
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    const started = Date.now();
    const timer = window.setInterval(() => {
      if (Date.now() - started >= GIVE_UP_AFTER_MS) {
        window.clearInterval(timer);
        setSlow(true);
        return;
      }

      router.refresh();
    }, INTERVAL_MS);

    return () => window.clearInterval(timer);
  }, [router]);

  if (slow) {
    return (
      <div role="status" aria-live="polite" className="mt-6 flex flex-col gap-3">
        <h2 className="text-lg font-semibold tracking-tight">Still confirming</h2>
        <p className="text-sm text-ink-muted">
          Stripe has your payment, so you don’t need to pay again. We’ll email you when the
          booking is confirmed, and it will appear in My bookings.
        </p>
        <Link href="/account/bookings" className={buttonClassName({ variant: "secondary", className: "w-max" })}>
          Go to My bookings
        </Link>
      </div>
    );
  }

  return (
    <p role="status" aria-live="polite" className="mt-6 flex items-center gap-3 text-sm text-ink-muted">
      <span
        aria-hidden="true"
        className="h-5 w-5 rounded-full border-[2.5px] border-line-strong border-t-action motion-safe:animate-spin"
      />
      Waiting for Stripe to confirm…
    </p>
  );
}
