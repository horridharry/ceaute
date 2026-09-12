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

export function formatSingleDateTime(value) {
  const dateTime = formatBookingDateTime(value, value);

  if (
    dateTime.date === BOOKING_FALLBACK_LABEL ||
    dateTime.time === BOOKING_FALLBACK_LABEL
  ) {
    return BOOKING_FALLBACK_LABEL;
  }

  return `${dateTime.date}, ${dateTime.time.split(" - ")[0]}`;
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

export function formatBookingActor(actor) {
  const labels = {
    customer: "Customer",
    provider: "Provider",
  };

  return labels[actor] ?? BOOKING_FALLBACK_LABEL;
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
      "booking_id, attempt_number, amount_charged_pence, total_booking_value_pence, amount_due_later_pence, ceaute_fee_pence, payment_status, refund_amount_pence, retained_amount_pence, refund_requested_at, refunded_at, refund_failed_at, failure_reason",
    )
    .in("booking_id", bookingIds)
    .order("attempt_number", { ascending: true });

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
  const startAt = new Date(booking.start_at);
  const cancellationWindowHours = Number(
    serviceSnapshot.cancellation_window_hours ?? 24,
  );
  const cancellationDeadline =
    Number.isNaN(startAt.getTime()) || !Number.isFinite(cancellationWindowHours)
      ? null
      : new Date(startAt.getTime() - cancellationWindowHours * 60 * 60_000);
  const amountPaidPence = Number(paymentAttempt?.amount_charged_pence);
  const commitmentAmountPence = Number(serviceSnapshot.commitment_amount_pence);
  const customerLateRetainedPence =
    Number.isInteger(amountPaidPence) && Number.isInteger(commitmentAmountPence)
      ? Math.min(Math.max(commitmentAmountPence, 0), Math.max(amountPaidPence, 0))
      : null;
  const isLateCustomerCancellation =
    cancellationDeadline instanceof Date && new Date() >= cancellationDeadline;
  const customerCurrentRetainedPence = isLateCustomerCancellation
    ? customerLateRetainedPence
    : 0;
  const customerCurrentRefundPence =
    Number.isInteger(amountPaidPence) && customerCurrentRetainedPence !== null
      ? Math.max(0, amountPaidPence - customerCurrentRetainedPence)
      : null;
  const isFutureConfirmed =
    booking.status === "confirmed" &&
    Boolean(booking.confirmed_at) &&
    !Number.isNaN(startAt.getTime()) &&
    startAt > new Date();
  const canExposePrivateLocation =
    Boolean(booking.confirmed_at) &&
    (booking.status === "confirmed" || booking.status === "completed");

  return {
    id: booking.id,
    booking_id: booking.id,
    status: booking.status ?? null,
    confirmed_at: booking.confirmed_at ?? null,
    status_label: formatBookingStatus(booking.status),
    cancelled_at: booking.cancelled_at ?? null,
    cancelled_by: booking.cancelled_by ?? null,
    cancelled_by_label: formatBookingActor(booking.cancelled_by),
    cancelled_at_label: booking.cancelled_at
      ? formatSingleDateTime(booking.cancelled_at)
      : BOOKING_FALLBACK_LABEL,
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
    amount_paid_online_pence: Number.isInteger(amountPaidPence)
      ? amountPaidPence
      : null,
    amount_due_at_appointment_label: formatMoneyFromPence(
      paymentAttempt?.amount_due_later_pence,
    ),
    amount_due_at_appointment_pence: Number.isInteger(
      Number(paymentAttempt?.amount_due_later_pence),
    )
      ? Number(paymentAttempt.amount_due_later_pence)
      : null,
    refund_amount_label: formatMoneyFromPence(
      booking.cancellation_refund_pence ?? paymentAttempt?.refund_amount_pence,
    ),
    refund_amount_pence:
      booking.cancellation_refund_pence ?? paymentAttempt?.refund_amount_pence,
    retained_amount_label: formatMoneyFromPence(
      booking.cancellation_retained_pence ??
        paymentAttempt?.retained_amount_pence,
    ),
    retained_amount_pence:
      booking.cancellation_retained_pence ??
      paymentAttempt?.retained_amount_pence,
    payment_status: paymentAttempt?.payment_status ?? null,
    refund_failed_reason: paymentAttempt?.failure_reason ?? "",
    refund_status_label:
      paymentAttempt?.payment_status === "refund_required"
        ? "Refund pending"
        : paymentAttempt?.payment_status === "refund_failed"
          ? "Refund failed"
          : paymentAttempt?.payment_status === "refunded"
            ? "Refund recorded"
            : "",
    public_area: serviceSnapshot.public_area ?? BOOKING_FALLBACK_LABEL,
    address_line_1: canExposePrivateLocation
      ? (serviceSnapshot.address_line_1 ?? "")
      : "",
    address_line_2: canExposePrivateLocation
      ? (serviceSnapshot.address_line_2 ?? "")
      : "",
    city: canExposePrivateLocation ? (serviceSnapshot.city ?? "") : "",
    postcode: canExposePrivateLocation ? (serviceSnapshot.postcode ?? "") : "",
    access_instructions: canExposePrivateLocation
      ? (serviceSnapshot.access_instructions ?? "")
      : "",
    cancellation_window_hours:
      serviceSnapshot.cancellation_window_hours ?? BOOKING_FALLBACK_LABEL,
    cancellation_deadline_label: cancellationDeadline
      ? formatSingleDateTime(cancellationDeadline.toISOString())
      : BOOKING_FALLBACK_LABEL,
    customer_early_refund_label: formatMoneyFromPence(
      paymentAttempt?.amount_charged_pence,
    ),
    customer_late_refund_label: formatMoneyFromPence(
      Number.isInteger(amountPaidPence) && customerLateRetainedPence !== null
        ? Math.max(0, amountPaidPence - customerLateRetainedPence)
        : null,
    ),
    customer_late_retained_label: formatMoneyFromPence(customerLateRetainedPence),
    customer_current_refund_label: formatMoneyFromPence(
      customerCurrentRefundPence,
    ),
    customer_current_retained_label: formatMoneyFromPence(
      customerCurrentRetainedPence,
    ),
    provider_refund_label: formatMoneyFromPence(paymentAttempt?.amount_charged_pence),
    can_cancel: isFutureConfirmed,
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
