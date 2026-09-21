import Link from "next/link";
import { legalIdentity } from "@/lib/legal/identity";

// There is no acceptance checkbox: continuing to payment is the acceptance
// interaction (see docs/product.md), so the policies must be reachable from
// both checkout steps before the customer pays. CCR 2013 Schedule 2 (b) and
// (c) also want the trader's identity and geographic address given before the
// consumer is bound, which is why they appear here and not only on /terms.
export function PolicyNotice() {
  return (
    <div className="mt-4 max-w-sm text-xs leading-relaxed text-black/55">
      <p>
        By continuing, you agree to our{" "}
        <Link href="/terms" className="font-semibold underline">
          Terms
        </Link>{" "}
        and{" "}
        <Link href="/privacy" className="font-semibold underline">
          Privacy Notice
        </Link>
        .
      </p>
      <details className="mt-2">
        <summary className="cursor-pointer font-medium text-black/65">
          Trader details
        </summary>
        <p className="mt-2">
          Ceaute is a trading name of {legalIdentity.operatorName}, a{" "}
          {legalIdentity.structure}, of {legalIdentity.businessAddress}.
          Questions and complaints:{" "}
          <a
            href={`mailto:${legalIdentity.contactEmail}`}
            className="font-semibold underline"
          >
            {legalIdentity.contactEmail}
          </a>
          . Your appointment is carried out by the provider named above, not by
          Ceaute.
        </p>
      </details>
    </div>
  );
}
