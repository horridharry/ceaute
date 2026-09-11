import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { updateBookingCustomerDetails } from "../../actions";
import { getPublicBookingDetailsPage } from "../../../_lib/public-provider-data";
import {
  addMinutes,
  formatDateLabel,
  formatDurationMinutes,
  formatPricePence,
  formatTimeLabel,
  hasPublicUsernamePrefix,
  normalizePublicUsername,
} from "../../../_lib/public-provider-format";

function normalizeAddOnSearch(searchParams) {
  const addOns = searchParams?.add_on;
  const addOnIds = Array.isArray(addOns) ? addOns : [addOns];

  return addOnIds.filter(Boolean).map((addOnId) => String(addOnId));
}

function buildDetailsPath({ username, serviceId, startAt, addOnIds }) {
  const searchParams = new URLSearchParams({ start_at: startAt });

  for (const addOnId of addOnIds) {
    searchParams.append("add_on", addOnId);
  }

  return `/@${username}/booking/${serviceId}/details?${searchParams.toString()}`;
}

function calculatePaymentSummary({ bookingSettings, totalPricePence }) {
  if (bookingSettings.payment_mode === "fixed_deposit") {
    const amountDueNow = Math.min(
      Number(bookingSettings.commitment_amount_pence ?? 0),
      totalPricePence,
    );

    return {
      amountDueNow,
      amountDueAtAppointment: totalPricePence - amountDueNow,
      cancellationOutcome: `${formatPricePence(amountDueNow)} is retained after late cancellation.`,
    };
  }

  const retainedAmount = Math.min(
    Number(bookingSettings.commitment_amount_pence ?? totalPricePence),
    totalPricePence,
  );

  return {
    amountDueNow: totalPricePence,
    amountDueAtAppointment: 0,
    cancellationOutcome: `${formatPricePence(retainedAmount)} is retained after late cancellation and the rest is refunded.`,
  };
}

export default async function UsernameDetailsPage({ params, searchParams }) {
  const { username, serviceId } = await params;
  const resolvedSearchParams = await searchParams;

  if (!hasPublicUsernamePrefix(username)) {
    notFound();
  }

  const decodedUsername = normalizePublicUsername(username);
  const selectedAddOnIds = normalizeAddOnSearch(resolvedSearchParams);
  const selectedStartAt = String(resolvedSearchParams?.start_at ?? "").trim();
  const detailsPath = buildDetailsPath({
    username: decodedUsername,
    serviceId,
    startAt: selectedStartAt,
    addOnIds: selectedAddOnIds,
  });
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const profileId = data?.claims?.sub;

  if (!profileId) {
    redirect(`/sign-in?next=${encodeURIComponent(detailsPath)}`);
  }

  const [
    {
      providerPage,
      treatment,
      selectedAddOns,
      totalDurationMinutes,
      totalPricePence,
      location,
      bookingSettings,
      availableDates,
    },
    profileResult,
  ] = await Promise.all([
    getPublicBookingDetailsPage(decodedUsername, serviceId, selectedAddOnIds),
    supabase
      .schema("ceaute")
      .from("profile")
      .select("full_name, phone_e164")
      .eq("id", profileId)
      .maybeSingle(),
  ]);

  if (profileResult.error) {
    throw new Error("Could not load your profile.");
  }

  const startAt = new Date(selectedStartAt);
  if (!selectedStartAt || Number.isNaN(startAt.getTime())) {
    redirect(`/@${providerPage.username}/booking/${treatment.id}`);
  }

  const selectedSlotStillAvailable = availableDates.some((date) =>
    date.slots.some((slot) => slot.start_at === startAt.toISOString()),
  );

  if (!selectedSlotStillAvailable) {
    redirect(`/@${providerPage.username}/booking/${treatment.id}`);
  }

  const endAt = addMinutes(startAt, totalDurationMinutes);
  const paymentSummary = calculatePaymentSummary({
    bookingSettings,
    totalPricePence,
  });

  return (
    <main className="container max-w-md p-5">
      <div className="mt-6 flex flex-col">
        <h1 className="text-3xl font-bold tracking-tighter">
          Review details
        </h1>
        <p className="mt-1 text-sm">
          Confirm your contact details before the final booking step.
        </p>

        <section className="mt-8 rounded-xl border p-4">
          <h2 className="text-lg font-semibold tracking-tighter">
            Order summary
          </h2>
          <div className="mt-4 flex flex-col gap-3 text-sm">
            <div>
              <p className="font-semibold">{providerPage.display_name}</p>
              <p className="text-black/60">@{providerPage.username}</p>
              {location.public_area ? (
                <p className="text-black/60">{location.public_area}</p>
              ) : null}
            </div>
            <div>
              <p className="font-semibold">{treatment.name}</p>
              {selectedAddOns.length ? (
                <ul className="mt-1 text-black/60">
                  {selectedAddOns.map((addOn) => (
                    <li key={addOn.id}>
                      + {addOn.name} (
                      {formatPricePence(addOn.additional_price_pence)},{" "}
                      {formatDurationMinutes(
                        addOn.additional_duration_minutes,
                      )}
                      )
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
            <div>
              <p className="font-semibold">
                {formatDateLabel(startAt)} · {formatTimeLabel(startAt)} -{" "}
                {formatTimeLabel(endAt)}
              </p>
              <p className="text-black/60">
                Total duration: {formatDurationMinutes(totalDurationMinutes)}
              </p>
            </div>
            <div className="border-t pt-3">
              <p className="flex justify-between">
                <span>Total price</span>
                <span className="font-semibold">
                  {formatPricePence(totalPricePence)}
                </span>
              </p>
              <p className="flex justify-between">
                <span>Due now</span>
                <span className="font-semibold">
                  {formatPricePence(paymentSummary.amountDueNow)}
                </span>
              </p>
              <p className="flex justify-between">
                <span>Due at appointment</span>
                <span className="font-semibold">
                  {formatPricePence(paymentSummary.amountDueAtAppointment)}
                </span>
              </p>
            </div>
            <div className="border-t pt-3 text-black/60">
              <p>
                Cancellation window:{" "}
                {bookingSettings.cancellation_window_hours ?? 24} hours.
              </p>
              <p>{paymentSummary.cancellationOutcome}</p>
              {bookingSettings.written_policy ? (
                <p className="mt-2 whitespace-pre-wrap">
                  {bookingSettings.written_policy}
                </p>
              ) : null}
            </div>
          </div>
        </section>

        <form
          action={updateBookingCustomerDetails}
          id="booking_details"
          className="mt-8 flex flex-col gap-4"
        >
          <span className="field-set">
            <label htmlFor="full_name" className="label">
              Full name
            </label>
            <input
              type="text"
              id="full_name"
              name="full_name"
              required
              defaultValue={profileResult.data?.full_name ?? ""}
              className="field"
            />
          </span>
          <span className="field-set">
            <label htmlFor="phone" className="label">
              Phone number
            </label>
            <input
              type="tel"
              id="phone"
              name="phone"
              required
              defaultValue={profileResult.data?.phone_e164 ?? ""}
              className="field"
            />
          </span>
          <div className="ml-auto mt-8 flex items-center gap-4">
            <SubmitButton />
          </div>
        </form>
      </div>
    </main>
  );
}

const SubmitButton = () => {
  return (
    <button
      form="booking_details"
      type="submit"
      className="w-max rounded-lg bg-pink-700 p-3 px-4 text-sm font-semibold text-white shadow-sm duration-200 hover:bg-pink-800 disabled:cursor-not-allowed disabled:opacity-60 aria-disabled:cursor-not-allowed aria-disabled:opacity-50"
    >
      Save details
    </button>
  );
};
