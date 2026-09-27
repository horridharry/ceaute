import assert from "node:assert/strict";
import test from "node:test";
import {
  formatDateBookingsLine,
  formatDropBookingsLine,
  toBookingCountsByDate,
} from "../src/app/(dashboard)/dashboard/availability/_lib/booking-messages.js";

test("formatDateBookingsLine is empty when the date has nothing on it", () => {
  assert.equal(formatDateBookingsLine(undefined), "");
  assert.equal(formatDateBookingsLine({ confirmed: 0, inProgress: 0 }), "");
});

test("formatDateBookingsLine counts bookings, singular and plural", () => {
  assert.equal(
    formatDateBookingsLine({ confirmed: 1, inProgress: 0 }),
    "1 booking on this day",
  );
  assert.equal(
    formatDateBookingsLine({ confirmed: 2, inProgress: 0 }),
    "2 bookings on this day",
  );
});

test("formatDateBookingsLine counts payments in progress, singular and plural", () => {
  assert.equal(
    formatDateBookingsLine({ confirmed: 0, inProgress: 1 }),
    "1 payment in progress",
  );
  assert.equal(
    formatDateBookingsLine({ confirmed: 0, inProgress: 2 }),
    "2 payments in progress",
  );
});

test("formatDateBookingsLine combines bookings and payments in progress", () => {
  assert.equal(
    formatDateBookingsLine({ confirmed: 2, inProgress: 1 }),
    "2 bookings and 1 payment in progress on this day",
  );
});

test("formatDropBookingsLine adds up its dates' bookings and payments in progress", () => {
  const countsByDate = {
    "2026-11-01": { confirmed: 2, inProgress: 0 },
    "2026-11-02": { confirmed: 1, inProgress: 1 },
    "2026-12-01": { confirmed: 5, inProgress: 5 },
  };
  const dates = [
    { local_date: "2026-11-01" },
    { local_date: "2026-11-02" },
    { local_date: "2026-11-03" },
  ];

  assert.equal(
    formatDropBookingsLine(dates, countsByDate),
    "3 bookings and 1 payment in progress",
  );
  assert.equal(
    formatDropBookingsLine([{ local_date: "2026-11-01" }], countsByDate),
    "2 bookings",
  );
  assert.equal(
    formatDropBookingsLine([{ local_date: "2026-11-01" }], {
      "2026-11-01": { confirmed: 1, inProgress: 0 },
    }),
    "1 booking",
  );
  assert.equal(
    formatDropBookingsLine([{ local_date: "2026-11-01" }], {
      "2026-11-01": { confirmed: 0, inProgress: 2 },
    }),
    "2 payments in progress",
  );
});

test("formatDropBookingsLine is empty when none of its dates has anything", () => {
  assert.equal(formatDropBookingsLine([{ local_date: "2026-11-03" }], {}), "");
  assert.equal(formatDropBookingsLine([], {}), "");
  assert.equal(formatDropBookingsLine(undefined, undefined), "");
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

test("the blocking wording is gone", async () => {
  const messages = await import(
    "../src/app/(dashboard)/dashboard/availability/_lib/booking-messages.js"
  );
  assert.equal(messages.formatBookingsOnDateMessage, undefined);
  assert.equal(messages.formatBlockedDateBookingsLine, undefined);
});
