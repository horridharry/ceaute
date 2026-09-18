import { notFound } from "next/navigation";
import { InlineLink } from "@/components/ui/button";
import { StackedTopBar } from "@/components/ui/top-bar";
import BookingScheduler from "../../_components/booking-scheduler";
import { getPublicBookingPage } from "../../../_lib/public-provider-data";
import {
  formatDurationMinutes,
  hasPublicUsernamePrefix,
  normalizePublicUsername,
} from "../../../_lib/public-provider-format";

function normalizeAddOnSearch(searchParams) {
  const addOns = searchParams?.add_on;
  const addOnIds = Array.isArray(addOns) ? addOns : [addOns];

  return addOnIds.filter(Boolean).map((addOnId) => String(addOnId));
}

function buildTreatmentPath({ username, treatmentId, addOnIds }) {
  const searchParams = new URLSearchParams();

  for (const addOnId of addOnIds) {
    searchParams.append("add_on", addOnId);
  }

  const query = searchParams.toString();
  return `/@${username}/book/${treatmentId}${query ? `?${query}` : ""}`;
}

// T4 · Picker. The sub-line carries the total duration only — it is the one
// fact that changes which slots are offered.
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
    selectedAddOns,
    totalDurationMinutes,
    availableDates,
  } = await getPublicBookingPage(
    decodedUsername,
    treatmentId,
    selectedAddOnIds,
  );

  const changeAddOnsHref = buildTreatmentPath({
    username: providerPage.username,
    treatmentId: treatment.id,
    addOnIds: selectedAddOns.map((addOn) => addOn.id),
  });

  return (
    <BookingScheduler
      username={providerPage.username}
      treatment={treatment}
      selectedAddOnIds={selectedAddOns.map((addOn) => addOn.id)}
      availableDates={availableDates}
      totalDurationMinutes={totalDurationMinutes}
      nav={
        <StackedTopBar
          backHref={changeAddOnsHref}
          backLabel={treatment.name}
          stepLabel="1 / 3"
        />
      }
      subtitle={
        <>
          {formatDurationMinutes(totalDurationMinutes)}
          {selectedAddOns.length ? (
            <>
              {" · "}
              <InlineLink href={changeAddOnsHref}>Change add-ons</InlineLink>
            </>
          ) : null}
        </>
      }
    />
  );
}
