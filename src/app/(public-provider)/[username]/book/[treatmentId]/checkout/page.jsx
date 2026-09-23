import { notFound, redirect } from "next/navigation";
import { PageContainer } from "@/components/ui/page-container";
import { PageHeading } from "@/components/ui/page-heading";
import {
  cancellationView,
  formatPounds,
  paymentView,
  snapshotPriceLines,
  termsFromQuote,
  termsFromSnapshot,
} from "@/lib/bookings/booking-money";
import { legalIdentity } from "@/lib/legal/identity";
import { formatUkPhoneNumber } from "@/lib/phone/normalize";
import { createClient } from "@/lib/supabase/server";
import {
  addMinutes,
  formatAppointmentWhen,
  formatDurationMinutes,
  formatPricePence,
  hasPublicUsernamePrefix,
  normalizePublicUsername,
} from "@/features/storefront/format";
import { normalizeAddOnSearch } from "@/features/storefront/add-on-search";
import { getBookingHoldSummary } from "../../queries";
import { findReusableHold, loadOwnedBooking } from "@/lib/bookings/checkout-session";
import {
  getProviderAcceptsBookings,
  getPublicBookingDetailsPage,
} from "../../../_lib/public-provider-data";
import {
  buildCheckoutPath,
  buildTimePath,
  firstSearchValue,
} from "./_lib/checkout-paths";
import {
  formatHeldUntil,
  heldBookingCopy,
  heldBookingState,
} from "./_lib/checkout-display";
import { HeldBooking } from "./_components/held-booking";
import { ReviewAndPay } from "./_components/review-and-pay";

const londonDate = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/London",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function searchValue(query, key) {
  return String(firstSearchValue(query?.[key]) ?? "").trim();
}

// One route, two screens (Specification §9.2 and §9.5):
//   * without ?hold — Review and pay, readable before signing in;
//   * with ?hold — the held page Stripe returns to.
export default async function BookingCheckoutPage({ params, searchParams }) {
  const { username, treatmentId } = await params;
  const query = await searchParams;

  if (!hasPublicUsernamePrefix(username)) {
    notFound();
  }

  const decodedUsername = normalizePublicUsername(username);
  const addOnIds = normalizeAddOnSearch(query);
  const startAtValue = searchValue(query, "start_at");
  const holdId = searchValue(query, "hold") || searchValue(query, "booking");
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const profileId = data?.claims?.sub ?? null;

  if (holdId) {
    if (!profileId) {
      const thisPage = buildCheckoutPath({
        username: decodedUsername,
        treatmentId,
        startAt: startAtValue,
        addOnIds,
        state: query,
      });
      redirect(`/sign-in?next=${encodeURIComponent(thisPage)}`);
    }

    return renderHeldBooking({ holdId, profileId, username: decodedUsername, treatmentId, addOnIds, query });
  }

  const {
    providerPage,
    treatment,
    selectedAddOns,
    totalDurationMinutes,
    totalPricePence,
    location,
    terms,
    availableDates,
  } = await getPublicBookingDetailsPage(decodedUsername, treatmentId, addOnIds);
  const selectedAddOnIds = selectedAddOns.map((addOn) => addOn.id);
  const startAt = new Date(startAtValue);

  if (!startAtValue || Number.isNaN(startAt.getTime())) {
    redirect(buildTimePath({ username: providerPage.username, treatmentId: treatment.id, addOnIds: selectedAddOnIds }));
  }

  const startAtIso = startAt.toISOString();
  const slotOpen = availableDates.some((date) => date.slots.some((slot) => slot.start_at === startAtIso));

  // The customer's own live hold for exactly this booking makes the time
  // look taken; Continue to payment carries on with it.
  if (!slotOpen) {
    const ownHold = profileId
      ? await findReusableHold({
          profileId,
          providerPageId: providerPage.id,
          treatmentId: treatment.id,
          startAt: startAtIso,
          addOnIds: selectedAddOnIds,
        })
      : null;

    if (!ownHold) {
      redirect(
        buildTimePath({
          username: providerPage.username,
          treatmentId: treatment.id,
          addOnIds: selectedAddOnIds,
          date: londonDate.format(startAt),
          notice: "taken",
        }),
      );
    }
  }

  const providerName = providerPage.display_name || `@${providerPage.username}`;
  const quote = termsFromQuote(terms, totalPricePence);
  let contact = null;

  if (profileId) {
    const { data: profile, error } = await supabase
      .schema("ceaute")
      .from("profile")
      .select("full_name, phone_e164")
      .eq("id", profileId)
      .maybeSingle();

    if (error) {
      throw new Error("Could not load your profile.");
    }

    contact = {
      name: profile?.full_name ?? "",
      phone: profile?.phone_e164 ? formatUkPhoneNumber(profile.phone_e164) : "",
      phoneDisplay: profile?.phone_e164 ? formatUkPhoneNumber(profile.phone_e164) : "",
      email: data?.claims?.email ?? "",
      missing: !profile?.full_name || !profile?.phone_e164,
    };
  }

  const reviewPath = buildCheckoutPath({
    username: providerPage.username,
    treatmentId: treatment.id,
    startAt: startAtIso,
    addOnIds: selectedAddOnIds,
  });
  const timePath = buildTimePath({
    username: providerPage.username,
    treatmentId: treatment.id,
    addOnIds: selectedAddOnIds,
    date: londonDate.format(startAt),
  });

  return (
    <PageContainer>
      <PageHeading back={{ href: timePath, label: "Times" }} title="Review and pay" />
      <ReviewAndPay
        provider={{ name: providerName, publicArea: location?.public_area ?? "" }}
        appointment={{
          when: formatAppointmentWhen(startAt, addMinutes(startAt, totalDurationMinutes)),
          duration: formatDurationMinutes(totalDurationMinutes),
          total: formatPricePence(totalPricePence),
        }}
        lines={[
          { key: "treatment", label: treatment.name, price: formatPricePence(treatment.price_pence), addOn: false },
          ...selectedAddOns.map((addOn) => ({
            key: addOn.id,
            label: addOn.name,
            price: formatPricePence(addOn.additional_price_pence),
            addOn: true,
          })),
        ]}
        money={quote ? paymentView(quote) : null}
        cancellation={
          quote
            ? cancellationView(quote, { startAt, providerName, policy: terms?.written_policy })
            : null
        }
        signedIn={Boolean(profileId)}
        contact={contact}
        hidden={{
          username: providerPage.username,
          treatment_id: treatment.id,
          start_at: startAtIso,
          add_on: selectedAddOnIds,
          expected_due_now_pence: String(terms?.amount_due_now_pence ?? ""),
          expected_total_pence: String(totalPricePence),
        }}
        links={{
          signIn: `/sign-in?next=${encodeURIComponent(reviewPath)}`,
          signUp: `/sign-up?next=${encodeURIComponent(reviewPath)}`,
        }}
      />
    </PageContainer>
  );
}

async function renderHeldBooking({ holdId, profileId, username, treatmentId, addOnIds, query }) {
  // Authorises the viewer, and ends the hold if its time has passed.
  const summary = await getBookingHoldSummary(holdId);

  if (!summary) {
    redirect(buildTimePath({ username, treatmentId, addOnIds }));
  }

  // Only the customer finishes a hold (the provider can read the summary).
  const { booking } = await loadOwnedBooking({ bookingId: summary.id, profileId });

  if (!booking) {
    notFound();
  }

  const checkout = searchValue(query, "checkout");
  const live =
    summary.status === "awaiting_payment" && Date.parse(summary.expires_at ?? "") > Date.now();
  const acceptingBookings = live ? await getProviderAcceptsBookings(booking.provider_page_id) : true;
  const state = heldBookingState({
    booking: summary,
    checkout,
    payment: searchValue(query, "payment"),
    notice: searchValue(query, "notice"),
    acceptingBookings,
  });

  if (state.kind === "confirmed") {
    redirect(`/account/bookings/${summary.id}${checkout === "success" ? "?checkout=success" : ""}`);
  }

  const snapshot = summary.service_snapshot ?? {};
  const providerUsername = snapshot.provider_username || username;
  const providerName = snapshot.provider_display_name || `@${providerUsername}`;
  const heldAddOnIds = (snapshot.selected_add_ons ?? []).map((addOn) => String(addOn?.id ?? "")).filter(Boolean);
  const terms = termsFromSnapshot(snapshot);
  const paid = summary.paid_attempt;

  return (
    <HeldBooking
      state={state}
      copy={heldBookingCopy(state, {
        providerName,
        heldUntil: formatHeldUntil(summary.expires_at),
        refundAmount: formatPounds(paid?.refund_amount_pence || paid?.amount_charged_pence || 0),
        contactEmail: legalIdentity.contactEmail,
      })}
      provider={{ name: providerName, publicArea: snapshot.public_area ?? "" }}
      appointment={{
        when: formatAppointmentWhen(summary.start_at, summary.end_at),
        duration: formatDurationMinutes(snapshot.duration_minutes),
        total: formatPounds(snapshot.total_price_pence),
      }}
      lines={snapshotPriceLines(snapshot)}
      money={paymentView(terms)}
      cancellation={cancellationView(terms, {
        startAt: summary.start_at,
        providerName,
        policy: snapshot.written_policy,
      })}
      bookingId={summary.id}
      links={{
        storefront: `/@${providerUsername}`,
        chooseTime: buildTimePath({
          username: providerUsername,
          treatmentId: booking.treatment_id,
          addOnIds: heldAddOnIds,
          date: londonDate.format(new Date(summary.start_at)),
        }),
      }}
    />
  );
}
