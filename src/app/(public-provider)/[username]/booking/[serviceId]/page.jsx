import BookingScheduler from "../_components/booking-scheduler";
import { getPublicBookingPage } from "../../_lib/public-provider-data";
import { notFound } from "next/navigation";
import {
  formatDurationMinutes,
  formatPricePence,
  hasPublicUsernamePrefix,
  normalizePublicUsername,
} from "../../_lib/public-provider-format";

function normalizeAddOnSearch(searchParams) {
  const addOns = searchParams?.add_on;
  const addOnIds = Array.isArray(addOns) ? addOns : [addOns];

  return addOnIds.filter(Boolean).map((addOnId) => String(addOnId));
}

export default async function UsernameBookingPage({ params, searchParams }) {
  const { username, serviceId } = await params;
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
    availableDates,
  } = await getPublicBookingPage(decodedUsername, serviceId, selectedAddOnIds);
  const selectedAddOnIdSet = new Set(selectedAddOns.map((addOn) => addOn.id));

  return (
    <main className="container max-w-md p-5">
      <div className="mt-6 flex flex-col">
        <h1 className="text-3xl font-bold tracking-tighter">Choose a time</h1>
        <p className="mt-1 text-sm">{`Booking with @${providerPage.username}`}</p>

        {compatibleAddOns.length ? (
          <form className="mt-8 rounded-lg border p-4">
            <h2 className="text-sm font-semibold">Add-ons</h2>
            <div className="mt-3 flex flex-col gap-3">
              {compatibleAddOns.map((addOn) => (
                <label
                  key={addOn.id}
                  className="flex items-center gap-3 text-sm"
                  htmlFor={`add_on_${addOn.id}`}
                >
                  <input
                    id={`add_on_${addOn.id}`}
                    type="checkbox"
                    name="add_on"
                    value={addOn.id}
                    defaultChecked={selectedAddOnIdSet.has(addOn.id)}
                    className="h-4 w-4"
                  />
                  <span className="flex-1">{addOn.name}</span>
                  <span className="text-black/60">
                    +{formatPricePence(addOn.additional_price_pence)} · +
                    {formatDurationMinutes(addOn.additional_duration_minutes)}
                  </span>
                </label>
              ))}
            </div>
            <button
              type="submit"
              className="mt-4 w-max rounded-lg border border-black/10 p-2 px-4 text-sm font-semibold text-pink-600 duration-200 hover:border-black/20"
            >
              Update times
            </button>
          </form>
        ) : null}

        <p className="mt-8 text-sm font-medium">
          Appointment duration: {formatDurationMinutes(totalDurationMinutes)}
        </p>

        <div className="mt-4 flex flex-col gap-4 rounded-lg border">
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
