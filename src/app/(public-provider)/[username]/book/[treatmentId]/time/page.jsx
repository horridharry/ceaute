import Link from "next/link";
import { notFound } from "next/navigation";
import { Notice } from "@/components/ui/notice";
import { PageContainer } from "@/components/ui/page-container";
import { PageHeading } from "@/components/ui/page-heading";
import { WhenSuitsYou } from "../../_components/when-suits-you";
import { buildDayStrip } from "../../_lib/time-choices";
import {
  getProviderAcceptsBookings,
  getPublicBookingPage,
} from "../../../_lib/public-provider-data";
import {
  formatDurationMinutes,
  formatPricePence,
  hasPublicUsernamePrefix,
  normalizePublicUsername,
} from "@/features/storefront/format";
import { normalizeAddOnSearch } from "@/features/storefront/add-on-search";
import { firstSearchValue } from "../checkout/_lib/checkout-paths";

function addOnsPath({ username, treatmentId, addOnIds }) {
  const searchParams = new URLSearchParams();

  for (const addOnId of addOnIds) {
    searchParams.append("add_on", addOnId);
  }

  const query = searchParams.toString();
  return `/@${username}/book/${treatmentId}${query ? `?${query}` : ""}`;
}

// "When suits you?" (approved 23 September 2026). The times come from the
// same calculator as before; PostgreSQL checks the chosen one again when the
// hold is made.
export default async function TreatmentBookingTimePage({ params, searchParams }) {
  const { username, treatmentId } = await params;
  const resolvedSearchParams = await searchParams;

  if (!hasPublicUsernamePrefix(username)) {
    notFound();
  }

  const decodedUsername = normalizePublicUsername(username);
  const selectedAddOnIds = normalizeAddOnSearch(resolvedSearchParams);
  const {
    providerPage,
    treatment,
    compatibleAddOns,
    selectedAddOns,
    totalDurationMinutes,
    totalPricePence,
    availableDates,
  } = await getPublicBookingPage(decodedUsername, treatmentId, selectedAddOnIds);
  const takingBookings = await getProviderAcceptsBookings(providerPage.id);
  const addOnIds = selectedAddOns.map((addOn) => addOn.id);
  const notice = firstSearchValue(resolvedSearchParams?.notice);
  const summary = [
    [treatment.name, ...selectedAddOns.map((addOn) => addOn.name)].join(" + "),
    formatDurationMinutes(totalDurationMinutes),
    formatPricePence(totalPricePence),
  ].join(" · ");

  return (
    <PageContainer>
      <PageHeading
        back={{ href: `/@${providerPage.username}`, label: providerPage.display_name || `@${providerPage.username}` }}
        title="When suits you?"
      />
      <p className="mt-2 text-sm text-ink-muted">
        {summary}
        {compatibleAddOns.length ? (
          <>
            {" "}
            <Link
              href={addOnsPath({ username: providerPage.username, treatmentId: treatment.id, addOnIds })}
              className="font-semibold text-accent underline-offset-2 hover:underline"
            >
              Change add-ons
            </Link>
          </>
        ) : null}
      </p>

      {notice === "taken" ? (
        <Notice role="alert" className="mt-5">
          That time was just taken. Choose another time.
        </Notice>
      ) : null}

      {takingBookings ? (
        <WhenSuitsYou
          days={buildDayStrip(availableDates)}
          providerName={providerPage.display_name || `@${providerPage.username}`}
          username={providerPage.username}
          treatmentId={treatment.id}
          addOnIds={addOnIds}
          initialDate={firstSearchValue(resolvedSearchParams?.date)}
        />
      ) : (
        <Notice tone="neutral" className="mt-6">
          {providerPage.display_name || "This provider"} isn’t taking online bookings right
          now. Nothing has been charged.
        </Notice>
      )}
    </PageContainer>
  );
}
