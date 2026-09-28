import { composeClassName } from "@/components/ui/class-names";

// For the pilot the checkout carries no "By continuing you agree" line and no
// trader details (decided 28 September 2026 by the product owner; they come
// back before providers who are not personal connections join, see
// docs/pilot.md). The Terms and Privacy pages stay linked from the footer.
export function CheckoutFinePrint({ className = "" }) {
  return (
    <p className={composeClassName("text-xs leading-relaxed text-ink-muted", className)}>
      We hold this time for 10 minutes, and for as long as the payment page is open.
    </p>
  );
}
