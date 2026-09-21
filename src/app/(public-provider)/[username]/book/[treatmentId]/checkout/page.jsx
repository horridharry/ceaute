import { redirect, notFound } from "next/navigation";
import { calculateBookingPaymentAmounts } from "@/lib/payments/booking-payments";
import { createClient } from "@/lib/supabase/server";
import {
  getBookingHoldSummary,
  getBookingInspirationImages,
} from "../../queries";
import { describeCheckoutPaymentNotice } from "../../_lib/checkout-payment-notice";
import { getPublicBookingDetailsPage } from "../../../_lib/public-provider-data";
import {
  addMinutes,
  hasPublicUsernamePrefix,
  normalizePublicUsername,
} from "@/features/storefront/format";
import { normalizeAddOnSearch } from "@/features/storefront/add-on-search";
import {
  firstSearchValue,
  buildCheckoutPath,
  buildReturnPath,
  buildTimePath,
} from "./_lib/checkout-paths";
import {
  calculatePaymentSummary,
  getBookingDisplayState,
} from "./_lib/checkout-display";
import { BookingHoldCheckout } from "./_components/booking-hold-checkout";
import { BookingDetailsCheckout } from "./_components/booking-details-checkout";

export default async function BookingCheckoutPage({ params, searchParams }) {
  const { username, treatmentId } = await params;
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
  const checkoutPath = buildCheckoutPath({
    username: decodedUsername,
    treatmentId,
    startAt: selectedStartAt,
    addOnIds: selectedAddOnIds,
    state: resolvedSearchParams,
  });
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const profileId = data?.claims?.sub;

  if (!profileId) {
    redirect(`/sign-in?next=${encodeURIComponent(checkoutPath)}`);
  }

  if (holdId) {
    const holdSummary = await getBookingHoldSummary(holdId);

    if (!holdSummary) {
      redirect(
        buildTimePath({
          username: decodedUsername,
          treatmentId,
          addOnIds: selectedAddOnIds,
        }),
      );
    }

    const holdStartAt = new Date(holdSummary.start_at);
    const holdEndAt = new Date(holdSummary.end_at);
    const serviceSnapshot = holdSummary.service_snapshot ?? {};
    const selectedAddOns = serviceSnapshot.selected_add_ons ?? [];
    const isConfirmed =
      holdSummary.status === "confirmed" && Boolean(holdSummary.confirmed_at);

    if (
      isConfirmed &&
      firstSearchValue(resolvedSearchParams?.checkout) === "success"
    ) {
      redirect(`/account/bookings/${holdSummary.id}?checkout=success`);
    }

    const paymentAmounts = calculateBookingPaymentAmounts(serviceSnapshot);
    const displayState = getBookingDisplayState(holdSummary);
    const inspiration = await getBookingInspirationImages(holdSummary.id);
    const paymentNotice = describeCheckoutPaymentNotice(
      firstSearchValue(resolvedSearchParams?.payment),
    );
    const returnPath = buildReturnPath({
      username: decodedUsername,
      treatmentId,
      startAt: selectedStartAt || holdSummary.start_at,
      addOnIds: selectedAddOnIds,
      holdId: holdSummary.id,
    });

    return (
      <BookingHoldCheckout
        displayState={displayState}
        paymentNotice={paymentNotice}
        serviceSnapshot={serviceSnapshot}
        selectedAddOns={selectedAddOns}
        holdStartAt={holdStartAt}
        holdEndAt={holdEndAt}
        paymentAmounts={paymentAmounts}
        isConfirmed={isConfirmed}
        inspiration={inspiration}
        holdSummary={holdSummary}
        returnPath={returnPath}
      />
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
    getPublicBookingDetailsPage(decodedUsername, treatmentId, selectedAddOnIds),
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
    redirect(
      buildTimePath({
        username: providerPage.username,
        treatmentId: treatment.id,
        addOnIds: selectedAddOns.map((addOn) => addOn.id),
      }),
    );
  }

  const selectedSlotStillAvailable = availableDates.some((date) =>
    date.slots.some((slot) => slot.start_at === startAt.toISOString()),
  );

  if (!selectedSlotStillAvailable) {
    redirect(
      buildTimePath({
        username: providerPage.username,
        treatmentId: treatment.id,
        addOnIds: selectedAddOns.map((addOn) => addOn.id),
      }),
    );
  }

  const endAt = addMinutes(startAt, totalDurationMinutes);
  const paymentSummary = calculatePaymentSummary({
    bookingSettings,
    totalPricePence,
  });

  return (
    <BookingDetailsCheckout
      providerPage={providerPage}
      treatment={treatment}
      selectedAddOns={selectedAddOns}
      startAt={startAt}
      endAt={endAt}
      totalDurationMinutes={totalDurationMinutes}
      totalPricePence={totalPricePence}
      location={location}
      bookingSettings={bookingSettings}
      paymentSummary={paymentSummary}
      profileResult={profileResult}
    />
  );
}
