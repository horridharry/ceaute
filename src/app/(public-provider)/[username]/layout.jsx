import { notFound } from "next/navigation";
import { hasPublicUsernamePrefix } from "@/features/storefront/format";
import AppHeader from "@/components/app-header/app-header";
import { SiteFooter } from "@/components/site-footer";
import { BookingFlowFooterGate } from "./_components/booking-flow-footer-gate";

export default async function UsernameLayout({ params, children }) {
  const { username } = await params;

  if (!hasPublicUsernamePrefix(username)) {
    notFound();
  }

  return (
    <>
      <AppHeader />
      {children}
      <BookingFlowFooterGate>
        <SiteFooter />
      </BookingFlowFooterGate>
    </>
  );
}
