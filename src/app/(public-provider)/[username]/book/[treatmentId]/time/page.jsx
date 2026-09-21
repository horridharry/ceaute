import Link from "next/link";
import { notFound } from "next/navigation";
import BookingScheduler from "../../_components/booking-scheduler";
import { BookingTreatmentSummary } from "../../_components/booking-treatment-summary";
import { getPublicBookingPage } from "../../../_lib/public-provider-data";
import {
  formatDurationMinutes,
  hasPublicUsernamePrefix,
  normalizePublicUsername,
} from "@/features/storefront/format";
import { normalizeAddOnSearch } from "@/features/storefront/add-on-search";

function buildTreatmentPath({ username, treatmentId, addOnIds }) {
  const searchParams = new URLSearchParams();

  for (const addOnId of addOnIds) {
    searchParams.append("add_on", addOnId);
  }

  const query = searchParams.toString();
  return `/@${username}/book/${treatmentId}${query ? `?${query}` : ""}`;
}

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

  return (
    <main className="container max-w-md p-5">
      <div className="mt-6 flex flex-col">
        <h1 className="text-3xl font-bold tracking-tighter">Choose a time</h1>
        <p className="mt-1 text-sm">{`Booking with @${providerPage.username}`}</p>

        <div className="mt-8">
          <BookingTreatmentSummary treatment={treatment} />
        </div>

        {selectedAddOns.length ? (
          <ul className="mt-4 text-sm text-black/60">
            {selectedAddOns.map((addOn) => (
              <li key={addOn.id}>+ {addOn.name}</li>
            ))}
          </ul>
        ) : null}

        <div className="mt-4 flex items-center justify-between gap-4">
          <p className="text-sm font-medium">
            Appointment duration: {formatDurationMinutes(totalDurationMinutes)}
          </p>
          <Link
            href={buildTreatmentPath({
              username: providerPage.username,
              treatmentId: treatment.id,
              addOnIds: selectedAddOns.map((addOn) => addOn.id),
            })}
            className="text-sm font-semibold text-pink-600"
          >
            Change add-ons
          </Link>
        </div>

        <div className="mt-4 flex flex-col gap-4 rounded-lg border border-black/10">
          <BookingScheduler
            username={providerPage.username}
            treatment={treatment}
            selectedAddOnIds={selectedAddOns.map((addOn) => addOn.id)}
            availableDates={availableDates}
          />
        </div>
      </div>
    </main>
  );
}
