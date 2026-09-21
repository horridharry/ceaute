import assert from "node:assert/strict";
import test from "node:test";
import {
  formatBlockedDateBookingsLine,
  formatBookingsOnDateMessage,
  toBookingCountsByDate,
} from "../src/app/(dashboard)/dashboard/availability/_lib/booking-messages.js";

const DATE = "Saturday 18 October";

test("formatBookingsOnDateMessage says nothing when no date is chosen", () => {
  assert.equal(formatBookingsOnDateMessage({ confirmed: 2, inProgress: 1 }, ""), "");
  assert.equal(formatBookingsOnDateMessage(undefined, undefined), "");
});

test("formatBookingsOnDateMessage reports no bookings for missing or zero counts", () => {
  assert.equal(formatBookingsOnDateMessage(undefined, DATE), "No bookings on this date.");
  assert.equal(
    formatBookingsOnDateMessage({ confirmed: 0, inProgress: 0 }, DATE),
    "No bookings on this date.",
  );
});

test("formatBookingsOnDateMessage explains confirmed bookings stay, singular and plural", () => {
  assert.equal(
    formatBookingsOnDateMessage({ confirmed: 1, inProgress: 0 }, DATE),
    "You have 1 booking on Saturday 18 October. It'll stay booked. Blocking only stops new ones.",
  );
  assert.equal(
    formatBookingsOnDateMessage({ confirmed: 2, inProgress: 0 }, DATE),
    "You have 2 bookings on Saturday 18 October. They'll stay booked. Blocking only stops new ones.",
  );
});

test("formatBookingsOnDateMessage explains payments in progress can finish, singular and plural", () => {
  assert.equal(
    formatBookingsOnDateMessage({ confirmed: 0, inProgress: 1 }, DATE),
    "1 booking is being paid for on Saturday 18 October right now. If payment finishes, it will be booked. Blocking only stops new ones.",
  );
  assert.equal(
    formatBookingsOnDateMessage({ confirmed: 0, inProgress: 2 }, DATE),
    "2 bookings are being paid for on Saturday 18 October right now. If payment finishes, they will be booked. Blocking only stops new ones.",
  );
});

test("formatBookingsOnDateMessage covers bookings and payments in progress together", () => {
  assert.equal(
    formatBookingsOnDateMessage({ confirmed: 2, inProgress: 1 }, DATE),
    "You have 2 bookings on Saturday 18 October, and 1 more is being paid for right now. Existing bookings stay, and payments already started can still finish. Blocking only stops new ones.",
  );
  assert.equal(
    formatBookingsOnDateMessage({ confirmed: 1, inProgress: 2 }, DATE),
    "You have 1 booking on Saturday 18 October, and 2 more are being paid for right now. Existing bookings stay, and payments already started can still finish. Blocking only stops new ones.",
  );
});

test("formatBlockedDateBookingsLine is empty when the date has nothing on it", () => {
  assert.equal(formatBlockedDateBookingsLine(undefined), "");
  assert.equal(formatBlockedDateBookingsLine({ confirmed: 0, inProgress: 0 }), "");
});

test("formatBlockedDateBookingsLine counts bookings, singular and plural", () => {
  assert.equal(
    formatBlockedDateBookingsLine({ confirmed: 1, inProgress: 0 }),
    "1 booking on this day",
  );
  assert.equal(
    formatBlockedDateBookingsLine({ confirmed: 2, inProgress: 0 }),
    "2 bookings on this day",
  );
});

test("formatBlockedDateBookingsLine counts payments in progress, singular and plural", () => {
  assert.equal(
    formatBlockedDateBookingsLine({ confirmed: 0, inProgress: 1 }),
    "1 payment in progress",
  );
  assert.equal(
    formatBlockedDateBookingsLine({ confirmed: 0, inProgress: 2 }),
    "2 payments in progress",
  );
});

test("formatBlockedDateBookingsLine combines bookings and payments in progress", () => {
  assert.equal(
    formatBlockedDateBookingsLine({ confirmed: 2, inProgress: 1 }),
    "2 bookings and 1 payment in progress on this day",
  );
});

test("toBookingCountsByDate keys numeric counts by local date", () => {
  assert.deepEqual(
    toBookingCountsByDate([
      { local_date: "2026-10-18", confirmed_count: 2, in_progress_count: 1 },
      { local_date: "2026-10-19", confirmed_count: "0", in_progress_count: "3" },
    ]),
    {
      "2026-10-18": { confirmed: 2, inProgress: 1 },
      "2026-10-19": { confirmed: 0, inProgress: 3 },
    },
  );
});

test("toBookingCountsByDate returns an empty object for no rows", () => {
  assert.deepEqual(toBookingCountsByDate([]), {});
  assert.deepEqual(toBookingCountsByDate(null), {});
});
