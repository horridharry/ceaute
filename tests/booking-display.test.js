import assert from "node:assert/strict";
import test from "node:test";
import {
  BOOKING_FALLBACK_LABEL,
  bookingToDisplayBooking,
  formatSingleDateTime,
  groupBookingsByTiming,
  normalizeBookingSnapshots,
} from "../src/lib/bookings/booking-display.js";

const START_AT = "2026-10-20T10:00:00.000Z";

function booking(overrides = {}) {
  return {
    id: "booking-1",
    status: "confirmed",
    confirmed_at: "2026-10-01T09:00:00.000Z",
    start_at: START_AT,
    end_at: "2026-10-20T11:00:00.000Z",
    customer_snapshot: {
      full_name: "Current Name",
      email: "customer@example.com",
      phone: "+447700900000",
    },
    service_snapshot: {
      provider_display_name: "Provider",
      treatment_name: "Full set",
      cancellation_window_hours: 48,
      selected_add_ons: [
        {
          id: "add-on-1",
          name: "Nail art",
          additional_price_pence: 500,
          additional_duration_minutes: 15,
        },
      ],
    },
    ...overrides,
  };
}

function hoursBeforeStart(hours) {
  return new Date(new Date(START_AT).getTime() - hours * 60 * 60_000).toISOString();
}

test("current snapshots pass through normalisation unchanged in meaning", () => {
  const { customer, service, cancellationWindowHours } =
    normalizeBookingSnapshots(booking());

  assert.equal(customer.full_name, "Current Name");
  assert.equal(customer.email, "customer@example.com");
  assert.equal(service.selected_add_ons[0].id, "add-on-1");
  assert.equal(cancellationWindowHours, 48);
});

test("historical customer snapshots use `name` when `full_name` is absent", () => {
  const display = bookingToDisplayBooking(
    booking({ customer_snapshot: { name: "Historical Name" } }),
  );

  assert.equal(display.customer_name, "Historical Name");
});

test("historical add-on snapshots without an id use the add-on name", () => {
  const display = bookingToDisplayBooking(
    booking({
      service_snapshot: { selected_add_ons: [{ name: "Gel removal" }] },
    }),
  );

  assert.deepEqual(
    display.selected_add_ons.map((addOn) => addOn.id),
    ["Gel removal"],
  );
});

test("a missing cancellation window is timed at 24 hours but still shown as unavailable", () => {
  const display = bookingToDisplayBooking(
    booking({ service_snapshot: { treatment_name: "Full set" } }),
  );

  assert.equal(display.cancellation_window_hours, BOOKING_FALLBACK_LABEL);
  assert.equal(
    display.cancellation_deadline_label,
    formatSingleDateTime(hoursBeforeStart(24)),
  );
});

test("a stored cancellation window sets the deadline", () => {
  const display = bookingToDisplayBooking(booking());

  assert.equal(display.cancellation_window_hours, 48);
  assert.equal(
    display.cancellation_deadline_label,
    formatSingleDateTime(hoursBeforeStart(48)),
  );
});

test("missing or malformed snapshots fall back to unavailable labels", () => {
  const display = bookingToDisplayBooking(
    booking({ customer_snapshot: null, service_snapshot: [] }),
  );

  assert.equal(display.customer_name, BOOKING_FALLBACK_LABEL);
  assert.equal(display.treatment_name, BOOKING_FALLBACK_LABEL);
  assert.deepEqual(display.selected_add_ons, []);
});

test("unpaid holds do not expose the private address", () => {
  const display = bookingToDisplayBooking(
    booking({
      status: "awaiting_payment",
      confirmed_at: null,
      service_snapshot: { address_line_1: "1 Private Street", postcode: "AB1 2CD" },
    }),
  );

  assert.equal(display.address_line_1, "");
  assert.equal(display.postcode, "");
});

test("an empty booking list groups into empty sections", () => {
  assert.deepEqual(groupBookingsByTiming([]), {
    upcoming: [],
    previous: [],
    cancelled: [],
  });
});

// Money shown to the customer before they cancel must match what PostgreSQL
// will actually refund: everything paid online before the deadline, and at
// most the snapshotted commitment retained once the deadline has passed.
function deposit(overrides = {}) {
  return {
    amount_charged_pence: 1000,
    amount_due_later_pence: 4000,
    payment_status: "succeeded",
    ...overrides,
  };
}

function isoHoursFromNow(hours) {
  return new Date(Date.now() + hours * 60 * 60_000).toISOString();
}

test("an early customer cancellation of a deposit booking refunds the whole online payment", () => {
  const display = bookingToDisplayBooking(
    booking({
      start_at: isoHoursFromNow(72),
      end_at: isoHoursFromNow(73),
      service_snapshot: {
        treatment_name: "Full set",
        payment_mode: "fixed_deposit",
        commitment_amount_pence: 1000,
        cancellation_window_hours: 24,
      },
    }),
    deposit(),
  );

  assert.equal(display.can_cancel, true);
  assert.equal(display.customer_early_refund_label, "£10.00");
  assert.equal(display.customer_late_refund_label, "£0.00");
  assert.equal(display.customer_late_retained_label, "£10.00");
  assert.equal(display.customer_current_refund_label, "£10.00");
  assert.equal(display.customer_current_retained_label, "£0.00");
  assert.equal(display.provider_refund_label, "£10.00");
});

test("a late customer cancellation retains at most the snapshotted commitment", () => {
  const display = bookingToDisplayBooking(
    booking({
      start_at: isoHoursFromNow(6),
      end_at: isoHoursFromNow(7),
      service_snapshot: {
        treatment_name: "Full set",
        payment_mode: "full",
        commitment_amount_pence: 1500,
        cancellation_window_hours: 24,
      },
    }),
    deposit({ amount_charged_pence: 5000, amount_due_later_pence: 0 }),
  );

  assert.equal(display.can_cancel, true);
  assert.equal(display.customer_current_refund_label, "£35.00");
  assert.equal(display.customer_current_retained_label, "£15.00");
  assert.equal(display.provider_refund_label, "£50.00");
});

test("the retained amount never exceeds what was actually paid online", () => {
  const display = bookingToDisplayBooking(
    booking({
      start_at: isoHoursFromNow(6),
      end_at: isoHoursFromNow(7),
      service_snapshot: {
        treatment_name: "Full set",
        payment_mode: "fixed_deposit",
        commitment_amount_pence: 5000,
        cancellation_window_hours: 24,
      },
    }),
    deposit({ amount_charged_pence: 1000 }),
  );

  assert.equal(display.customer_current_refund_label, "£0.00");
  assert.equal(display.customer_current_retained_label, "£10.00");
});

test("past, unpaid, completed and cancelled bookings cannot be cancelled", () => {
  const cases = [
    booking({ start_at: isoHoursFromNow(-2), end_at: isoHoursFromNow(-1), status: "confirmed" }),
    booking({ start_at: isoHoursFromNow(48), end_at: isoHoursFromNow(49), status: "awaiting_payment", confirmed_at: null }),
    booking({ start_at: isoHoursFromNow(48), end_at: isoHoursFromNow(49), status: "completed" }),
    booking({ start_at: isoHoursFromNow(48), end_at: isoHoursFromNow(49), status: "cancelled" }),
  ];

  for (const candidate of cases) {
    assert.equal(bookingToDisplayBooking(candidate, deposit()).can_cancel, false, candidate.status);
  }
});

test("noon and midnight appointment times are shown as 12:00, never 0:00", () => {
  const display = bookingToDisplayBooking(
    booking({
      start_at: "2026-10-20T11:00:00.000Z",
      end_at: "2026-10-20T12:30:00.000Z",
    }),
  );

  assert.equal(display.time_label, "12:00 pm - 1:30 pm");
  assert.equal(formatSingleDateTime("2026-10-20T23:15:00.000Z"), "Wednesday 21 Oct 2026, 12:15 am");
});
