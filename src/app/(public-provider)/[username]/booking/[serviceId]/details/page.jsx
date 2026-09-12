import { redirect, notFound } from "next/navigation";
import { calculateBookingPaymentAmounts } from "@/lib/payments/booking-payments";
import { createClient } from "@/lib/supabase/server";
import {
  confirmTestBookingHold,
  createBookingHoldFromDetails,
  getBookingHoldSummary,
  startStripeCheckoutForBooking,
} from "../../actions";
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

function buildReturnPath({ username, serviceId, startAt, addOnIds, holdId }) {
  const searchParams = new URLSearchParams({ start_at: startAt });

  for (const addOnId of addOnIds) {
    searchParams.append("add_on", addOnId);
  }

  searchParams.set("hold", holdId);

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

function getBookingDisplayState(booking, now = Date.now()) {
  if (booking.status === "confirmed") {
    return {
      heading: "Booking confirmed",
      message: "Your booking is confirmed.",
      canPay: false,
    };
  }

  const expiresAt = new Date(booking.expires_at ?? "").getTime();
  const isExpired =
    booking.status === "expired" ||
    (["awaiting_payment", "cancelled"].includes(booking.status) &&
      expiresAt <= now);

  if (isExpired) {
    return {
      heading: "Slot expired",
      message: "That held slot expired. Please choose a new time.",
      canPay: false,
    };
  }

  if (booking.status === "cancelled") {
    return {
      heading: "Booking cancelled",
      message: "This booking was cancelled and is not confirmed.",
      canPay: false,
    };
  }

  if (booking.status !== "awaiting_payment" || !Number.isFinite(expiresAt)) {
    return {
      heading: "Booking unavailable",
      message: "This booking cannot continue. Please choose a new time.",
      canPay: false,
    };
  }

  if (["failed", "cancelled"].includes(booking.payment_status)) {
    return {
      heading: "Payment failed",
      message: "Payment was not completed. Your booking has not been confirmed.",
      canPay: true,
      showHoldExpiry: true,
    };
  }

  if (
    ["refund_required", "refunded", "refund_failed"].includes(booking.payment_status)
  ) {
    return {
      heading: "Payment unsuccessful",
      message:
        "Your payment could not confirm this booking. Please choose a new time.",
      canPay: false,
      showHoldExpiry: true,
    };
  }

  if (
    ["created", "checkout_created", "succeeded"].includes(booking.payment_status)
  ) {
    return {
      heading: "Booking held",
      message:
        "Payment is being verified. This page will show confirmation once Stripe's webhook confirms it.",
      canPay: booking.payment_status !== "succeeded",
      showHoldExpiry: true,
    };
  }

  return {
    heading: "Booking held",
    message: "This time is held for 5 minutes while you continue.",
    canPay: !booking.payment_status,
    showHoldExpiry: true,
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
  const holdId = String(
    resolvedSearchParams?.booking ?? resolvedSearchParams?.hold ?? "",
  ).trim();
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

  if (holdId) {
    const holdSummary = await getBookingHoldSummary(holdId);

    if (!holdSummary) {
      redirect(`/@${decodedUsername}/booking/${serviceId}`);
    }

    const holdStartAt = new Date(holdSummary.start_at);
    const holdEndAt = new Date(holdSummary.end_at);
    const serviceSnapshot = holdSummary.service_snapshot ?? {};
    const selectedAddOns = serviceSnapshot.selected_add_ons ?? [];
    const isConfirmed = holdSummary.status === "confirmed";
    const paymentAmounts = calculateBookingPaymentAmounts(serviceSnapshot);
    const displayState = getBookingDisplayState(holdSummary);
    const testBookingsEnabled =
      process.env.CEAUTE_TEST_BOOKINGS_ENABLED === "true";
    const returnPath = buildReturnPath({
      username: decodedUsername,
      serviceId,
      startAt: selectedStartAt || holdSummary.start_at,
      addOnIds: selectedAddOnIds,
      holdId: holdSummary.id,
    });

    return (
      <main className="container max-w-md p-5">
        <div className="mt-6 flex flex-col">
          <h1 className="text-3xl font-bold tracking-tighter">
            {displayState.heading}
          </h1>
          <p className="mt-1 text-sm">
            {displayState.message}
          </p>

          <section className="mt-8 rounded-xl border p-4">
            <h2 className="text-lg font-semibold tracking-tighter">
              Booking summary
            </h2>
            <div className="mt-4 flex flex-col gap-3 text-sm">
              <div>
                <p className="font-semibold">
                  {serviceSnapshot.provider_display_name}
                </p>
                <p className="text-black/60">
                  @{serviceSnapshot.provider_username}
                </p>
                <p className="text-black/60">{serviceSnapshot.public_area}</p>
              </div>
              <div>
                <p className="font-semibold">{serviceSnapshot.treatment_name}</p>
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
                  {formatDateLabel(holdStartAt)} · {formatTimeLabel(holdStartAt)}{" "}
                  - {formatTimeLabel(holdEndAt)}
                </p>
                <p className="text-black/60">
                  Total duration:{" "}
                  {formatDurationMinutes(serviceSnapshot.duration_minutes)}
                </p>
              </div>
              <div className="border-t pt-3">
                <p className="flex justify-between">
                  <span>Total price</span>
                  <span className="font-semibold">
                    {formatPricePence(serviceSnapshot.total_price_pence)}
                  </span>
                </p>
                <p className="flex justify-between">
                  <span>Due now</span>
                  <span className="font-semibold">
                    {formatPricePence(paymentAmounts.amountChargedPence)}
                  </span>
                </p>
                <p className="flex justify-between">
                  <span>Due at appointment</span>
                  <span className="font-semibold">
                    {formatPricePence(paymentAmounts.amountDueLaterPence)}
                  </span>
                </p>
              </div>
              <div className="border-t pt-3 text-black/60">
                <p>
                  Cancellation window:{" "}
                  {serviceSnapshot.cancellation_window_hours ?? 24} hours.
                </p>
                {serviceSnapshot.written_policy ? (
                  <p className="mt-2 whitespace-pre-wrap">
                    {serviceSnapshot.written_policy}
                  </p>
                ) : null}
              </div>
              {isConfirmed ? (
                <div className="border-t pt-3">
                  <p className="font-semibold">Exact address</p>
                  <p>{serviceSnapshot.address_line_1}</p>
                  {serviceSnapshot.address_line_2 ? (
                    <p>{serviceSnapshot.address_line_2}</p>
                  ) : null}
                  <p>
                    {serviceSnapshot.city} {serviceSnapshot.postcode}
                  </p>
                  {serviceSnapshot.access_instructions ? (
                    <p className="mt-2 text-black/60">
                      {serviceSnapshot.access_instructions}
                    </p>
                  ) : null}
                </div>
              ) : (
                <p className="border-t pt-3 text-black/60">
                  Exact address and access instructions are shown after
                  confirmation.
                </p>
              )}
              {displayState.showHoldExpiry ? (
                <p className="text-black/60">
                  Hold expires at{" "}
                  {formatTimeLabel(new Date(holdSummary.expires_at))}.
                </p>
              ) : null}
            </div>
          </section>

          {displayState.canPay ? (
            <div className="mt-8 ml-auto flex flex-col items-end gap-3">
              <form action={startStripeCheckoutForBooking}>
                <input type="hidden" name="booking_id" value={holdSummary.id} />
                <input type="hidden" name="return_path" value={returnPath} />
                <button
                  type="submit"
                  className="w-max rounded-lg bg-pink-700 p-3 px-4 text-sm font-semibold text-white shadow-sm duration-200 hover:bg-pink-800"
                >
                  Pay with Stripe
                </button>
              </form>
              {testBookingsEnabled ? (
                <form action={confirmTestBookingHold}>
                  <input type="hidden" name="booking_id" value={holdSummary.id} />
                  <input type="hidden" name="return_path" value={returnPath} />
                  <button
                    type="submit"
                    className="w-max rounded-lg border p-3 px-4 text-sm font-semibold duration-200 hover:bg-black/5"
                  >
                    Confirm test booking
                  </button>
                </form>
              ) : null}
            </div>
          ) : null}
        </div>
      </main>
    );
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
          action={createBookingHoldFromDetails}
          id="booking_details"
          className="mt-8 flex flex-col gap-4"
        >
          <input type="hidden" name="username" value={providerPage.username} />
          <input type="hidden" name="treatment_id" value={treatment.id} />
          <input type="hidden" name="start_at" value={startAt.toISOString()} />
          {selectedAddOns.map((addOn) => (
            <input key={addOn.id} type="hidden" name="add_on" value={addOn.id} />
          ))}
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
      Continue
    </button>
  );
};
