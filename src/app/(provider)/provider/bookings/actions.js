"use server";
import { getSignedInProvider } from "../_lib/provider-data";

const FALLBACK_LABEL = "Unavailable";

function formatMoneyFromPence(value) {
  const pence = Number(value);

  if (!Number.isInteger(pence)) {
    return FALLBACK_LABEL;
  }

  return Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(pence / 100);
}

function formatDurationMinutes(value) {
  const minutes = Number(value);

  if (!Number.isInteger(minutes) || minutes <= 0) {
    return FALLBACK_LABEL;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  return [
    hours ? `${hours} ${hours === 1 ? "hour" : "hours"}` : "",
    remainingMinutes
      ? `${remainingMinutes} ${remainingMinutes === 1 ? "minute" : "minutes"}`
      : "",
  ]
    .filter(Boolean)
    .join(" ");
}

function formatDateTimeRange(startAtValue, endAtValue) {
  const startAt = new Date(startAtValue);
  const endAt = new Date(endAtValue);

  if (Number.isNaN(startAt.getTime()) || Number.isNaN(endAt.getTime())) {
    return {
      date: FALLBACK_LABEL,
      time: FALLBACK_LABEL,
    };
  }

  return {
    date: new Intl.DateTimeFormat("en-GB", {
      weekday: "long",
      day: "2-digit",
      month: "short",
    }).format(startAt),
    time: `${new Intl.DateTimeFormat("en-GB", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).format(startAt)} - ${new Intl.DateTimeFormat("en-GB", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).format(endAt)}`,
  };
}

function bookingToProviderBooking(booking) {
  const customerSnapshot = booking.customer_snapshot ?? {};
  const serviceSnapshot = booking.service_snapshot ?? {};
  const dateTime = formatDateTimeRange(booking.start_at, booking.end_at);

  return {
    booking_id: booking.id,
    customer_name: customerSnapshot.full_name ?? customerSnapshot.name ?? FALLBACK_LABEL,
    treatment_name: serviceSnapshot.treatment_name ?? FALLBACK_LABEL,
    status: booking.status ?? FALLBACK_LABEL,
    date_label: dateTime.date,
    time_label: dateTime.time,
    duration_label: formatDurationMinutes(serviceSnapshot.duration_minutes),
    total_price_label: formatMoneyFromPence(serviceSnapshot.total_price_pence),
    public_area: serviceSnapshot.public_area ?? FALLBACK_LABEL,
    selected_add_ons: Array.isArray(serviceSnapshot.selected_add_ons)
      ? serviceSnapshot.selected_add_ons.map((addOn) => ({
          id: addOn.id ?? addOn.name,
          name: addOn.name ?? FALLBACK_LABEL,
          price_label: formatMoneyFromPence(addOn.additional_price_pence),
          duration_label: formatDurationMinutes(
            addOn.additional_duration_minutes,
          ),
        }))
      : [],
  };
}

export const getAllBookings = async () => {
  const { supabase, providerPage } = await getSignedInProvider({
    next: "/provider/bookings",
  });

  const { data: bookings, error } = await supabase
    .schema("ceaute")
    .from("booking")
    .select(
      "id, start_at, end_at, status, customer_snapshot, service_snapshot",
    )
    .eq("provider_page_id", providerPage.id)
    .order("start_at", { ascending: true });

  if (error) {
    return [];
  }

  return bookings.map(bookingToProviderBooking);
};

export const getProviderBooking = async (bookingId) => {
  const { supabase, providerPage } = await getSignedInProvider({
    next: `/provider/bookings/${bookingId}`,
  });

  const { data: booking, error } = await supabase
    .schema("ceaute")
    .from("booking")
    .select(
      "id, start_at, end_at, status, customer_snapshot, service_snapshot",
    )
    .eq("provider_page_id", providerPage.id)
    .eq("id", bookingId)
    .maybeSingle();

  if (error) {
    throw new Error("Could not load booking.");
  }

  return booking ? bookingToProviderBooking(booking) : null;
};
