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
      hourCycle: "h12",
      timeZone: "Europe/London",
    }).format(startAt)} - ${new Intl.DateTimeFormat("en-GB", {
      hour: "numeric",
      minute: "2-digit",
      hourCycle: "h12",
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

// My bookings (Specification §10). What the customer sees of each booking:
//   hold      — waiting for payment and not yet ended: "Finish booking";
//   upcoming  — confirmed and not over (soonest first);
//   past      — completed, or confirmed and over (newest first);
//   cancelled — cancelled after it was confirmed, or a payment that arrived
//               after the hold ended and was refunded (newest first);
//   null      — a hold that ended with nothing paid: hidden from the lists
//               (its link still explains it), its records kept.
// `paidAttempt` is the attempt that took the money (selectPaidAttempt) and
// `holdExpiresAt` when the hold ends; the booking summaries return neither.
export const CUSTOMER_BOOKING_VIEWS = ["upcoming", "past", "cancelled"];

export function customerBookingView(booking, { paidAttempt = null, holdExpiresAt = null } = {}, now = new Date()) {
  if (booking.confirmed_at) {
    if (booking.status === "cancelled") {
      return "cancelled";
    }

    if (booking.status === "completed") {
      return "past";
    }

    const endAt = new Date(booking.end_at).getTime();
    return Number.isFinite(endAt) && endAt <= now.getTime() ? "past" : "upcoming";
  }

  if (paidAttempt) {
    return "cancelled";
  }

  const expiresAt = new Date(holdExpiresAt ?? "").getTime();

  if (booking.status === "awaiting_payment" && Number.isFinite(expiresAt) && expiresAt > now.getTime()) {
    return "hold";
  }

  return null;
}

export function customerBookingViewFromParam(value) {
  return CUSTOMER_BOOKING_VIEWS.includes(value) ? value : "upcoming";
}

// Holds soonest to end first; Upcoming soonest first; Past and Cancelled
// newest first.
export function groupCustomerBookings(bookings, now = new Date()) {
  const groups = { hold: [], upcoming: [], past: [], cancelled: [] };

  for (const booking of bookings) {
    const view = customerBookingView(
      booking,
      { paidAttempt: booking.paid_attempt ?? null, holdExpiresAt: booking.hold_expires_at ?? null },
      now,
    );
    if (view) groups[view].push(booking);
  }

  const byStart = (first, second) => String(first.start_at).localeCompare(String(second.start_at));
  groups.hold.sort((first, second) => String(first.hold_expires_at).localeCompare(String(second.hold_expires_at)));
  groups.upcoming.sort(byStart);
  groups.past.sort((first, second) => byStart(second, first));
  groups.cancelled.sort((first, second) => byStart(second, first));

  return groups;
}

// The provider dashboard's appointment filters. A booking row is only an
// appointment once it has been paid for: status confirmed, then completed, or
// cancelled by a person (cancelled_by is set only by
// prepare_booking_cancellation). Holds are not appointments and belong in no
// provider list, count or detail page:
//   - an unpaid hold (awaiting_payment, live or past its expiry), and
//   - an expired or retired hold (cancelled with no cancelled_by), including
//     one whose payment arrived late and was refunded automatically.
// The rows themselves are kept; this only decides what the provider sees.
// The customer account keeps categorizeBooking above.
export const PROVIDER_BOOKING_VIEWS = ["upcoming", "completed", "cancelled"];

export function providerBookingView(booking, now = new Date()) {
  if (booking.status === "confirmed") {
    const endAt = new Date(booking.end_at).getTime();
    return Number.isFinite(endAt) && endAt <= now.getTime() ? "completed" : "upcoming";
  }

  if (booking.status === "completed") {
    return "completed";
  }

  if (booking.status === "cancelled" && booking.cancelled_by) {
    return "cancelled";
  }

  return null;
}

export function isProviderAppointment(booking) {
  return providerBookingView(booking) !== null;
}

// Upcoming soonest first; Completed and Cancelled newest first.
export function groupProviderBookings(bookings, now = new Date()) {
  const groups = { upcoming: [], completed: [], cancelled: [] };

  for (const booking of bookings) {
    const view = providerBookingView(booking, now);
    if (view) groups[view].push(booking);
  }

  const byStart = (first, second) => String(first.start_at).localeCompare(String(second.start_at));
  groups.upcoming.sort(byStart);
  groups.completed.sort((first, second) => byStart(second, first));
  groups.cancelled.sort((first, second) => byStart(second, first));

  return groups;
}

// Older links used ?view=previous for what is now Completed.
export function providerBookingViewFromParam(value) {
  if (value === "previous") return "completed";
  return PROVIDER_BOOKING_VIEWS.includes(value) ? value : "upcoming";
}

// Booking snapshots are stored JSON and older rows use older shapes. This is the
// only place that knows about those shapes; display code reads the result.
export function normalizeBookingSnapshots(booking) {
  const storedCustomer = isPlainObject(booking.customer_snapshot)
    ? booking.customer_snapshot
    : {};
  const storedService = isPlainObject(booking.service_snapshot)
    ? booking.service_snapshot
    : {};
  const storedAddOns = Array.isArray(storedService.selected_add_ons)
    ? storedService.selected_add_ons
    : [];

  return {
    customer: {
      ...storedCustomer,
      // Older customer snapshots stored `name` instead of `full_name`.
      full_name: storedCustomer.full_name ?? storedCustomer.name,
    },
    service: {
      ...storedService,
      // Older add-on snapshots had no `id`; the name was the only identifier.
      selected_add_ons: storedAddOns.map((addOn) => ({
        ...addOn,
        id: addOn.id ?? addOn.name,
      })),
    },
    // Snapshots without a cancellation window are timed with the 24-hour
    // default PostgreSQL also applies. The stored window itself is left as-is.
    cancellationWindowHours: Number(storedService.cancellation_window_hours ?? 24),
  };
}

export function bookingToDisplayBooking(booking, paymentAttempt = null) {
  const { customer, service, cancellationWindowHours } =
    normalizeBookingSnapshots(booking);
  const dateTime = formatBookingDateTime(booking.start_at, booking.end_at);
  const startAt = new Date(booking.start_at);
  const cancellationDeadline =
    Number.isNaN(startAt.getTime()) || !Number.isFinite(cancellationWindowHours)
      ? null
      : new Date(startAt.getTime() - cancellationWindowHours * 60 * 60_000);
  const amountPaidPence = Number(paymentAttempt?.amount_charged_pence);
  const commitmentAmountPence = Number(service.commitment_amount_pence);
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
    customer_name: customer.full_name ?? BOOKING_FALLBACK_LABEL,
    customer_email: customer.email ?? BOOKING_FALLBACK_LABEL,
    customer_phone: customer.phone ?? BOOKING_FALLBACK_LABEL,
    provider_name: service.provider_display_name ?? BOOKING_FALLBACK_LABEL,
    provider_username: service.provider_username ?? "",
    treatment_name: service.treatment_name ?? BOOKING_FALLBACK_LABEL,
    treatment_description:
      service.treatment_description ?? BOOKING_FALLBACK_LABEL,
    date_label: dateTime.date,
    time_label: dateTime.time,
    duration_label: formatDurationMinutes(service.duration_minutes),
    duration_minutes: service.duration_minutes ?? null,
    total_price_label: formatMoneyFromPence(service.total_price_pence),
    total_price_pence: Number.isInteger(Number(service.total_price_pence))
      ? Number(service.total_price_pence)
      : null,
    // paymentAttempt is the attempt that took the money; without one nothing
    // was paid online.
    amount_paid_online_label: formatMoneyFromPence(
      paymentAttempt ? paymentAttempt.amount_charged_pence : 0,
    ),
    amount_paid_online_pence: paymentAttempt
      ? (Number.isInteger(amountPaidPence) ? amountPaidPence : null)
      : 0,
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
    public_area: service.public_area ?? BOOKING_FALLBACK_LABEL,
    address_line_1: canExposePrivateLocation
      ? (service.address_line_1 ?? "")
      : "",
    address_line_2: canExposePrivateLocation
      ? (service.address_line_2 ?? "")
      : "",
    city: canExposePrivateLocation ? (service.city ?? "") : "",
    postcode: canExposePrivateLocation ? (service.postcode ?? "") : "",
    access_instructions: canExposePrivateLocation
      ? (service.access_instructions ?? "")
      : "",
    cancellation_window_hours:
      service.cancellation_window_hours ?? BOOKING_FALLBACK_LABEL,
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
    written_policy: service.written_policy ?? "",
    payment_mode: service.payment_mode ?? BOOKING_FALLBACK_LABEL,
    selected_add_ons: service.selected_add_ons.map((addOn) => ({
      id: addOn.id,
      name: addOn.name ?? BOOKING_FALLBACK_LABEL,
      price_label: formatMoneyFromPence(addOn.additional_price_pence),
      duration_label: formatDurationMinutes(addOn.additional_duration_minutes),
      duration_minutes: addOn.additional_duration_minutes ?? null,
    })),
  };
}
