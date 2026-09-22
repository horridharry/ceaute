import { notFound } from "next/navigation";
import {
  hasPublicUsernamePrefix,
  normalizePublicUsername,
} from "@/features/storefront/format";
import AppHeader from "@/components/app-header/app-header";
import { SiteFooter } from "@/components/site-footer";
import { getPublishedProviderPageByUsername } from "./_lib/public-provider-data";
import { BookingFlowFooterGate } from "./_components/booking-flow-footer-gate";

export default async function UsernameLayout({ params, children }) {
  const { username } = await params;

  if (!hasPublicUsernamePrefix(username)) {
    notFound();
  }

  // The published-page check runs here, outside this segment's loading.jsx
  // Suspense boundary, so a missing or unpublished provider is known before
  // anything streams and the response can still be a real 404. After a
  // fallback has streamed, Next.js can only mark the page noindex with a 200.
  // The lookup is cached per request, so the pages below reuse it.
  await getPublishedProviderPageByUsername(normalizePublicUsername(username));

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
