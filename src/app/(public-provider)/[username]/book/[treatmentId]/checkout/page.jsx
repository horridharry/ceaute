import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { calculateBookingPaymentAmounts } from "@/lib/payments/booking-payments";
import { createClient } from "@/lib/supabase/server";
import {
  createBookingHoldFromDetails,
  getBookingHoldSummary,
  startStripeCheckoutForBooking,
} from "../../actions";
import { describeCheckoutPaymentNotice } from "../../_lib/checkout-payment-notice";
import { FormTemplate } from "@/components/templates/form-template";
import { ButtonLink } from "@/components/ui/button";
import { CommitBar } from "@/components/ui/commit-bar";
import { HeldRow } from "@/components/ui/held-row";
import { InfoNotice, ProblemNotice } from "@/components/ui/notice";
import { SummaryCard, SummaryLine } from "@/components/ui/summary-card";
import { SubmitButton } from "@/components/ui/submit-button";
import { TextInput } from "@/components/ui/field";
import { StackedTopBar } from "@/components/ui/top-bar";
import { BookingConfirming } from "../../_components/booking-confirming";
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

function firstSearchValue(value) {
  return Array.isArray(value) ? value[0] : value;
}

function buildCheckoutPath({
  username,
  treatmentId,
  startAt,
  addOnIds,
  state = {},
}) {
  const searchParams = new URLSearchParams({ start_at: startAt });

  for (const addOnId of addOnIds) {
    searchParams.append("add_on", addOnId);
  }

  const holdId = firstSearchValue(state.hold ?? state.booking);
  const preservedValues = {
    hold: holdId,
    checkout: firstSearchValue(state.checkout),
    session_id: firstSearchValue(state.session_id),
    next: firstSearchValue(state.next),
    payment: firstSearchValue(state.payment),
  };

  for (const [key, value] of Object.entries(preservedValues)) {
    if (value) {
      searchParams.set(key, String(value));
    }
  }

  return `/@${username}/book/${treatmentId}/checkout?${searchParams.toString()}`;
}

function buildReturnPath({ username, treatmentId, startAt, addOnIds, holdId }) {
  const searchParams = new URLSearchParams({ start_at: startAt });

  for (const addOnId of addOnIds) {
    searchParams.append("add_on", addOnId);
  }

  searchParams.set("hold", holdId);

  return `/@${username}/book/${treatmentId}/checkout?${searchParams.toString()}`;
}

function buildTimePath({ username, treatmentId, addOnIds }) {
  const searchParams = new URLSearchParams();

  for (const addOnId of addOnIds) {
    searchParams.append("add_on", addOnId);
  }

  const query = searchParams.toString();
  return `/@${username}/book/${treatmentId}/time${query ? `?${query}` : ""}`;
}

// Mirrors prepare_booking_cancellation: a late customer cancellation retains
// least(commitment amount, amount actually paid online) and refunds the rest.
// Both checkout steps state this, because the Terms promise the retained
// amount is shown before the customer pays.
function describeLateCancellationOutcome({
  commitmentAmountPence,
  amountDueNowPence,
}) {
  const retainedPence = Math.min(
    Math.max(0, Number(commitmentAmountPence ?? 0)),
    amountDueNowPence,
  );

  return retainedPence < amountDueNowPence
    ? `${formatPricePence(retainedPence)} is retained after late cancellation and the rest is refunded.`
    : `${formatPricePence(retainedPence)} is retained after late cancellation.`;
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
      cancellationOutcome: describeLateCancellationOutcome({
        commitmentAmountPence: bookingSettings.commitment_amount_pence,
        amountDueNowPence: amountDueNow,
      }),
    };
  }

  return {
    amountDueNow: totalPricePence,
    amountDueAtAppointment: 0,
    cancellationOutcome: describeLateCancellationOutcome({
      commitmentAmountPence:
        bookingSettings.commitment_amount_pence ?? totalPricePence,
      amountDueNowPence: totalPricePence,
    }),
  };
}

// There is no acceptance checkbox: continuing to payment is the acceptance
// interaction (see docs/product.md), so the policies must be reachable from
// both checkout steps before the customer pays.
function PolicyNotice() {
  return (
    <p className="mt-4 text-xs text-black/60">
      By continuing you agree to Ceaute&rsquo;s{" "}
      <Link href="/terms" className="font-semibold underline">
        Terms
      </Link>{" "}
      and{" "}
      <Link href="/privacy" className="font-semibold underline">
        Privacy notice
      </Link>
      .
    </p>
  );
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

    // A6. Stripe has returned but the webhook has not confirmed yet, so the
    // booking is not successful and must not be shown as though it were. The
    // confirmed case above has already redirected away.
    if (firstSearchValue(resolvedSearchParams?.checkout) === "success") {
      return (
        <BookingConfirming
          providerName={serviceSnapshot.provider_display_name}
          treatmentName={serviceSnapshot.treatment_name}
          whenLabel={`${formatDateLabel(holdStartAt)} · ${formatTimeLabel(holdStartAt)}`}
          amountPaidLabel={formatPricePence(paymentAmounts.amountChargedPence)}
        />
      );
    }

    const paymentState = firstSearchValue(resolvedSearchParams?.payment);
    // A payment already in flight is the dangerous one: a second payment is a
    // second charge, so Pay is removed entirely rather than merely warned
    // about. Amber, not red — nothing has gone wrong yet.
    const paymentInFlight = paymentState === "processing";
    const canPay = displayState.canPay && !paymentInFlight;
    const timeHref = buildTimePath({
      username: decodedUsername,
      treatmentId,
      addOnIds: selectedAddOnIds,
    });

    return (
      <FormTemplate
        as="div"
        nav={
          <StackedTopBar
            backHref={timeHref}
            backLabel="Times"
            stepLabel="3 / 3"
          />
        }
        commitBar={
          canPay ? (
            <CommitBar
              contextLabel={formatPricePence(paymentAmounts.amountChargedPence)}
              contextDetail="Card details are taken by Stripe. You'll land back here."
            >
              <form action={startStripeCheckoutForBooking}>
                <input type="hidden" name="booking_id" value={holdSummary.id} />
                <input type="hidden" name="return_path" value={returnPath} />
                <SubmitButton block={false} pendingLabel="Opening Stripe" className="px-6">
                  {paymentState === "unavailable" ? "Try again" : "Continue to payment"}
                </SubmitButton>
              </form>
            </CommitBar>
          ) : (
            <CommitBar>
              <ButtonLink
                href={paymentInFlight ? "/account/bookings" : timeHref}
                variant={paymentInFlight ? "tertiary" : "primary"}
              >
                {paymentInFlight ? "Go to my bookings" : "See other days"}
              </ButtonLink>
            </CommitBar>
          )
        }
      >
        {displayState.showHoldExpiry && holdSummary.expires_at ? (
          <HeldRow
            appointmentLabel={`${formatDateLabel(holdStartAt)}, ${formatTimeLabel(holdStartAt)}`}
            expiresAt={holdSummary.expires_at}
          />
        ) : null}

        <header className="flex flex-col gap-1">
          <h1 className="text-display text-pretty text-ink">
            {canPay ? "Review & pay" : displayState.heading}
          </h1>
          {canPay ? null : (
            <p className="text-meta text-black/50">{displayState.message}</p>
          )}
        </header>

        {paymentInFlight ? (
          <ProblemNotice tone="pending" title="Waiting on Stripe">
            An earlier attempt for this booking is still finishing. Give it a few
            seconds rather than paying again — a second payment would be a second
            charge. Your slot stays held until{" "}
            {formatTimeLabel(new Date(holdSummary.expires_at))} while this resolves.
          </ProblemNotice>
        ) : paymentNotice ? (
          <ProblemNotice title={paymentNotice.heading}>
            {paymentNotice.message}
          </ProblemNotice>
        ) : null}

        <SummaryCard>
          <SummaryLine
            label={serviceSnapshot.treatment_name}
            value={formatPricePence(serviceSnapshot.total_price_pence)}
          />
          {selectedAddOns.map((addOn) => (
            <SummaryLine
              key={addOn.id}
              label={`+ ${addOn.name}`}
              value={formatPricePence(addOn.additional_price_pence)}
            />
          ))}
          <SummaryLine
            label={`${formatDateLabel(holdStartAt)} · ${formatTimeLabel(holdStartAt)} – ${formatTimeLabel(holdEndAt)}`}
            value={formatDurationMinutes(serviceSnapshot.duration_minutes)}
          />
          <SummaryLine
            label={
              paymentAmounts.amountDueLaterPence > 0 ? "Pay today (deposit)" : "Pay today"
            }
            value={formatPricePence(paymentAmounts.amountChargedPence)}
            total
          />
        </SummaryCard>

        <p className="text-[12.5px]/[1.55] text-black/60">
          {formatPricePence(paymentAmounts.amountDueLaterPence)} due on the day.
          Cancellation window {serviceSnapshot.cancellation_window_hours ?? 24}{" "}
          hours.{" "}
          {describeLateCancellationOutcome({
            commitmentAmountPence: serviceSnapshot.commitment_amount_pence,
            amountDueNowPence: paymentAmounts.amountChargedPence,
          })}
        </p>

        {serviceSnapshot.written_policy ? (
          <InfoNotice>{serviceSnapshot.written_policy}</InfoNotice>
        ) : null}

        {isConfirmed ? (
          <div className="flex flex-col gap-1">
            <p className="text-label uppercase text-black/45">Where</p>
            <p className="text-body text-black/80">
              {[
                serviceSnapshot.address_line_1,
                serviceSnapshot.address_line_2,
                `${serviceSnapshot.city} ${serviceSnapshot.postcode}`,
              ]
                .filter(Boolean)
                .join(", ")}
            </p>
            {serviceSnapshot.access_instructions ? (
              <p className="text-[12.5px] text-black/60">
                {serviceSnapshot.access_instructions}
              </p>
            ) : null}
          </div>
        ) : (
          <p className="text-[12.5px] text-black/60">
            The exact address and access instructions are shown once the booking
            is confirmed.
          </p>
        )}

        {canPay ? <PolicyNotice /> : null}
      </FormTemplate>
    );
  }

  const [
    {
      providerPage,
      treatment,
      selectedAddOns,
      totalDurationMinutes,
      totalPricePence,
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
    <FormTemplate
      action={createBookingHoldFromDetails}
      id="booking_details"
      nav={
        <StackedTopBar
          backHref={buildTimePath({
            username: providerPage.username,
            treatmentId: treatment.id,
            addOnIds: selectedAddOns.map((addOn) => addOn.id),
          })}
          backLabel="Times"
          stepLabel="2 / 3"
        />
      }
      notice={
        bookingSettings.written_policy ? (
          <InfoNotice>{bookingSettings.written_policy}</InfoNotice>
        ) : null
      }
      commitBar={
        <CommitBar
          contextLabel={formatPricePence(paymentSummary.amountDueNow)}
          contextDetail="Held for five minutes once you continue."
        >
          <SubmitButton block={false} pendingLabel="Holding your time" className="px-6">
            Continue
          </SubmitButton>
        </CommitBar>
      }
    >
      <header className="flex flex-col gap-1">
        <h1 className="text-display text-pretty text-ink">Review &amp; pay</h1>
        <p className="text-meta text-black/50">
          {providerPage.display_name} · {formatDateLabel(startAt)} ·{" "}
          {formatTimeLabel(startAt)} – {formatTimeLabel(endAt)}
        </p>
      </header>

      {/* Both are required before the hold is created (docs/product.md). The
          server action validates and normalises them; these are the same two
          fields under different clothes. */}
      <input type="hidden" name="username" value={providerPage.username} />
      <input type="hidden" name="treatment_id" value={treatment.id} />
      <input type="hidden" name="start_at" value={startAt.toISOString()} />
      {selectedAddOns.map((addOn) => (
        <input key={addOn.id} type="hidden" name="add_on" value={addOn.id} />
      ))}

      <TextInput
        name="full_name"
        label="Full name"
        required
        autoComplete="name"
        defaultValue={profileResult.data?.full_name ?? ""}
      />
      <TextInput
        id="phone"
        name="phone"
        label="UK mobile"
        type="tel"
        required
        autoComplete="tel"
        defaultValue={profileResult.data?.phone_e164 ?? ""}
        helper={`Shared with ${providerPage.display_name} for this appointment only.`}
      />

      <SummaryCard className="mt-2">
        <SummaryLine
          label={treatment.name}
          value={formatPricePence(treatment.price_pence)}
        />
        {selectedAddOns.map((addOn) => (
          <SummaryLine
            key={addOn.id}
            label={`+ ${addOn.name}`}
            value={formatPricePence(addOn.additional_price_pence)}
          />
        ))}
        <SummaryLine
          label={formatDurationMinutes(totalDurationMinutes)}
          value={formatPricePence(totalPricePence)}
        />
        <SummaryLine
          label={
            paymentSummary.amountDueAtAppointment > 0
              ? "Pay today (deposit)"
              : "Pay today"
          }
          value={formatPricePence(paymentSummary.amountDueNow)}
          total
        />
      </SummaryCard>

      <p className="text-[12.5px]/[1.55] text-black/60">
        {formatPricePence(paymentSummary.amountDueAtAppointment)} due on the day.
        Cancellation window {bookingSettings.cancellation_window_hours ?? 24}{" "}
        hours. {paymentSummary.cancellationOutcome}
      </p>

      <PolicyNotice />
    </FormTemplate>
  );
}
