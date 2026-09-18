import Link from "next/link";
import {
  describeOperator,
  legalIdentity,
  needsSeparateAddressForService,
} from "@/lib/legal/identity";

// Electronic Commerce Regulations 2002 reg 6 wants the trader's name,
// geographic address and email "easily, directly and permanently accessible",
// which a link on one screen does not achieve — so this renders on every page.
// Values come from src/lib/legal/identity.js; nothing here is hardcoded.
export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-black/10 bg-white">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-8 text-xs leading-relaxed text-black/55 sm:px-6">
        <p className="text-black/70">{describeOperator()}</p>
        <address className="not-italic">
          {legalIdentity.businessAddress}
          {needsSeparateAddressForService() ? (
            <>
              <br />
              Address for service: {legalIdentity.addressForService}
            </>
          ) : null}
          <br />
          <a
            href={`mailto:${legalIdentity.contactEmail}`}
            className="font-medium text-black/70 hover:underline"
          >
            {legalIdentity.contactEmail}
          </a>
        </address>
        <div className="flex gap-4">
          <Link href="/terms" className="font-medium hover:underline">
            Terms
          </Link>
          <Link href="/privacy" className="font-medium hover:underline">
            Privacy
          </Link>
        </div>
      </div>
    </footer>
  );
}
