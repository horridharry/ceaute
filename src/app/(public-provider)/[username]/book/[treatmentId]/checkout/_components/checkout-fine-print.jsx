import Link from "next/link";
import { composeClassName } from "@/components/ui/class-names";
import { legalIdentity } from "@/lib/legal/identity";

// There is no acceptance checkbox: continuing to payment is the acceptance
// interaction (see docs/product.md), so the policies must be reachable before
// the customer pays. CCR 2013 Schedule 2 (b) and (c) also want the trader's
// identity and geographic address given before the consumer is bound, which
// is why they appear here and not only on /terms.
export function CheckoutFinePrint({ className = "" }) {
  return (
    <div className={composeClassName("text-xs leading-relaxed text-ink-muted", className)}>
      <p>
        By continuing you agree to the{" "}
        <Link href="/terms" className="font-semibold underline underline-offset-2">
          Terms
        </Link>{" "}
        and{" "}
        <Link href="/privacy" className="font-semibold underline underline-offset-2">
          Privacy Notice
        </Link>
        . We hold this time for 10 minutes, and for as long as the payment page is open.
      </p>
      <details className="group mt-1">
        <summary className="inline-flex min-h-11 cursor-pointer list-none items-center gap-1 rounded-lg font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus [&::-webkit-details-marker]:hidden">
          Trader details
          <svg
            aria-hidden="true"
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            className="h-3.5 w-3.5 group-open:rotate-180 motion-safe:transition-transform"
          >
            <path d="M5 7.5 10 12.5 15 7.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </summary>
        <p>
          Ceaute is a trading name of {legalIdentity.operatorName}, a {legalIdentity.structure}, of{" "}
          {legalIdentity.businessAddress}. Questions and complaints: {legalIdentity.contactEmail}. Your
          appointment is carried out by the provider named above, not by Ceaute.
        </p>
      </details>
    </div>
  );
}
