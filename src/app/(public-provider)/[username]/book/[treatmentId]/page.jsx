import { notFound } from "next/navigation";
import Form from "next/form";
import { PendingButton } from "@/components/pending-button";
import { BookingTreatmentSummary } from "../_components/booking-treatment-summary";
import { getPublicBookingPage } from "../../_lib/public-provider-data";
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

export default async function TreatmentBookingPage({ params, searchParams }) {
  const { username, treatmentId } = await params;
  const resolvedSearchParams = await searchParams;

  if (!hasPublicUsernamePrefix(username)) {
    notFound();
  }

  const decodedUsername = normalizePublicUsername(username);
  const selectedAddOnIds = normalizeAddOnSearch(resolvedSearchParams);
  const { providerPage, treatment, compatibleAddOns, selectedAddOns } =
    await getPublicBookingPage(
      decodedUsername,
      treatmentId,
      selectedAddOnIds,
    );
  const selectedAddOnIdSet = new Set(selectedAddOns.map((addOn) => addOn.id));

  return (
    <main className="container max-w-md p-5">
      <div className="mt-6 flex flex-col">
        <h1 className="text-3xl font-bold tracking-tighter">
          Choose add-ons
        </h1>
        <p className="mt-1 text-sm">{`Booking with @${providerPage.username}`}</p>

        <div className="mt-8">
          <BookingTreatmentSummary treatment={treatment} />
        </div>

        <Form
          action={`/@${providerPage.username}/book/${treatment.id}/time`}
          className="mt-8 rounded-lg border p-4"
        >
          <h2 className="text-sm font-semibold">Add-ons</h2>
          {compatibleAddOns.length ? (
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
          ) : (
            <p className="mt-3 text-sm text-black/60">
              No add-ons are available for this treatment.
            </p>
          )}
          <div className="mt-6 flex justify-end">
            <PendingButton
              pendingLabel="Continuing..."
              className="w-max rounded-lg bg-plum p-3 px-4 text-sm font-semibold text-white shadow-sm duration-200 hover:bg-plum-hover disabled:cursor-not-allowed disabled:opacity-60"
            >
              Continue
            </PendingButton>
          </div>
        </Form>
      </div>
    </main>
  );
}
