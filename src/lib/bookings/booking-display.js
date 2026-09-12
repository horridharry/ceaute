import { createServiceRoleClient } from "@/lib/supabase/service-role";

export const BOOKING_FALLBACK_LABEL = "Unavailable";

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function formatMoneyFromPence(value) {
  const pence = Number(value);

  if (!Number.isInteger(pence)) {
    return BOOKING_FALLBACK_LABEL;
  }

  return Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(pence / 100);
}

export function formatDurationMinutes(value) {
  const minutes = Number(value);

  if (!Number.isInteger(minutes) || minutes <= 0) {
    return BOOKING_FALLBACK_LABEL;
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

export function formatBookingDateTime(startAtValue, endAtValue) {
  const startAt = new Date(startAtValue);
  const endAt = new Date(endAtValue);

  if (Number.isNaN(startAt.getTime()) || Number.isNaN(endAt.getTime())) {
    return {
      date: BOOKING_FALLBACK_LABEL,
      time: BOOKING_FALLBACK_LABEL,
    };
  }

  return {
    date: new Intl.DateTimeFormat("en-GB", {
      weekday: "long",
      day: "2-digit",
      month: "short",
      year: "numeric",
      timeZone: "Europe/London",
    }).format(startAt),
    time: `${new Intl.DateTimeFormat("en-GB", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
      timeZone: "Europe/London",
    }).format(startAt)} - ${new Intl.DateTimeFormat("en-GB", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
      timeZone: "Europe/London",
    }).format(endAt)}`,
  };
}

export function formatBookingStatus(status) {
  const labels = {
    awaiting_payment: "Awaiting payment",
    confirmed: "Confirmed",
    completed: "Completed",
    cancelled: "Cancelled",
    expired: "Expired",
  };

  return labels[status] ?? BOOKING_FALLBACK_LABEL;
}

export function categorizeBooking(booking, now = new Date()) {
  if (booking.status === "cancelled" || booking.status === "expired") {
    return "cancelled";
  }

  const endAt = new Date(booking.end_at);

  if (booking.status === "completed" || endAt.getTime() < now.getTime()) {
    return "previous";
  }

  return "upcoming";
}

export function groupBookingsByTiming(bookings) {
  return bookings.reduce(
    (groups, booking) => {
      groups[categorizeBooking(booking)].push(booking);
      return groups;
    },
    { upcoming: [], previous: [], cancelled: [] },
  );
}

export async function getPaymentAttemptsForBookings(bookingIds) {
  if (!bookingIds.length) {
    return new Map();
  }

  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .schema("ceaute")
    .from("booking_payment_attempt")
    .select(
      "booking_id, amount_charged_pence, total_booking_value_pence, amount_due_later_pence, payment_status",
    )
    .in("booking_id", bookingIds);

  if (error) {
    throw new Error("Could not load booking payment summaries.");
  }

  return new Map((data ?? []).map((attempt) => [attempt.booking_id, attempt]));
}

export function bookingToDisplayBooking(booking, paymentAttempt = null) {
  const customerSnapshot = isPlainObject(booking.customer_snapshot)
    ? booking.customer_snapshot
    : {};
  const serviceSnapshot = isPlainObject(booking.service_snapshot)
    ? booking.service_snapshot
    : {};
  const dateTime = formatBookingDateTime(booking.start_at, booking.end_at);
  const addOns = Array.isArray(serviceSnapshot.selected_add_ons)
    ? serviceSnapshot.selected_add_ons
    : [];

  return {
    id: booking.id,
    booking_id: booking.id,
    status: booking.status ?? null,
    status_label: formatBookingStatus(booking.status),
    start_at: booking.start_at,
    end_at: booking.end_at,
    customer_name:
      customerSnapshot.full_name ??
      customerSnapshot.name ??
      BOOKING_FALLBACK_LABEL,
    customer_email: customerSnapshot.email ?? BOOKING_FALLBACK_LABEL,
    customer_phone: customerSnapshot.phone ?? BOOKING_FALLBACK_LABEL,
    provider_name: serviceSnapshot.provider_display_name ?? BOOKING_FALLBACK_LABEL,
    treatment_name: serviceSnapshot.treatment_name ?? BOOKING_FALLBACK_LABEL,
    treatment_description:
      serviceSnapshot.treatment_description ?? BOOKING_FALLBACK_LABEL,
    date_label: dateTime.date,
    time_label: dateTime.time,
    duration_label: formatDurationMinutes(serviceSnapshot.duration_minutes),
    total_price_label: formatMoneyFromPence(serviceSnapshot.total_price_pence),
    amount_paid_online_label: formatMoneyFromPence(
      paymentAttempt?.amount_charged_pence,
    ),
    amount_due_at_appointment_label: formatMoneyFromPence(
      paymentAttempt?.amount_due_later_pence,
    ),
    public_area: serviceSnapshot.public_area ?? BOOKING_FALLBACK_LABEL,
    address_line_1: serviceSnapshot.address_line_1 ?? "",
    address_line_2: serviceSnapshot.address_line_2 ?? "",
    city: serviceSnapshot.city ?? "",
    postcode: serviceSnapshot.postcode ?? "",
    access_instructions: serviceSnapshot.access_instructions ?? "",
    cancellation_window_hours:
      serviceSnapshot.cancellation_window_hours ?? BOOKING_FALLBACK_LABEL,
    written_policy: serviceSnapshot.written_policy ?? "",
    payment_mode: serviceSnapshot.payment_mode ?? BOOKING_FALLBACK_LABEL,
    selected_add_ons: addOns.map((addOn) => ({
      id: addOn.id ?? addOn.name,
      name: addOn.name ?? BOOKING_FALLBACK_LABEL,
      price_label: formatMoneyFromPence(addOn.additional_price_pence),
      duration_label: formatDurationMinutes(addOn.additional_duration_minutes),
    })),
  };
}

