import assert from "node:assert/strict";
import test from "node:test";
import {
  dropName,
  formatDropTime,
  monthName,
  openForBookingSentence,
  opensSentence,
  rangeName,
  summaryFromRows,
} from "../src/lib/availability/drops.js";

test("monthName reads the full English month name, no year", () => {
  assert.equal(monthName("2026-11-05"), "November");
  assert.equal(monthName("2026-01-31"), "January");
});

test("rangeName within one month uses an unspaced en dash", () => {
  assert.equal(rangeName("2026-11-01", "2026-11-14"), "1–14 November");
});

test("rangeName across months uses a spaced en dash", () => {
  assert.equal(rangeName("2026-10-28", "2026-11-10"), "28 October – 10 November");
});

test("rangeName of a one-date drop is that date, not a doubled range", () => {
  assert.equal(rangeName("2026-11-05", "2026-11-05"), "5 November");
});

test("rangeName spans December into January", () => {
  assert.equal(rangeName("2026-12-28", "2027-01-10"), "28 December – 10 January");
});

test("dropName names a single-month drop by its month when no other drop shares it", () => {
  assert.equal(
    dropName({ firstDate: "2026-11-01", lastDate: "2026-11-14", sharesMonth: false }),
    "November",
  );
});

test("dropName falls back to the range when another drop shares the month", () => {
  assert.equal(
    dropName({ firstDate: "2026-11-01", lastDate: "2026-11-14", sharesMonth: true }),
    "1–14 November",
  );
});

test("dropName uses the range when the dates cross months, regardless of sharesMonth", () => {
  assert.equal(
    dropName({ firstDate: "2026-10-28", lastDate: "2026-11-10", sharesMonth: false }),
    "28 October – 10 November",
  );
});

test("formatDropTime reads a BST date and time", () => {
  assert.equal(formatDropTime("2026-10-15T18:00:00Z"), "15 October at 7 pm");
});

test("formatDropTime reads a GMT date and time", () => {
  assert.equal(formatDropTime("2026-12-15T19:00:00Z"), "15 December at 7 pm");
});

test("formatDropTime reads a :30 time", () => {
  assert.equal(formatDropTime("2026-11-01T19:30:00Z"), "1 November at 7:30 pm");
});

test("formatDropTime accepts a Date as well as an ISO string", () => {
  assert.equal(
    formatDropTime(new Date("2026-10-15T18:00:00Z")),
    "15 October at 7 pm",
  );
});

test("opensSentence names the drop and when it opens", () => {
  assert.equal(
    opensSentence("November", "2026-10-15T18:00:00Z"),
    "November slots open on 15 October at 7 pm",
  );
});

test("openForBookingSentence joins one, two and three or more names", () => {
  assert.equal(openForBookingSentence(["October"]), "October slots are open for booking");
  assert.equal(
    openForBookingSentence(["October", "November"]),
    "October and November slots are open for booking",
  );
  assert.equal(
    openForBookingSentence(["October", "November", "December"]),
    "October, November and December slots are open for booking",
  );
});

test("openForBookingSentence gives an empty string for no names", () => {
  assert.equal(openForBookingSentence([]), "");
});

test("summaryFromRows gives no open drops and no next drop for no rows", () => {
  assert.deepEqual(summaryFromRows([]), { open: [], next: null });
});

test("summaryFromRows names every open row and finds no next drop", () => {
  assert.deepEqual(
    summaryFromRows([
      { drop_month: "2026-10-01", first_date: null, last_date: null, opens_at: null, is_open: true },
      { drop_month: null, first_date: "2026-11-01", last_date: "2026-11-14", opens_at: null, is_open: true },
    ]),
    { open: ["October", "1–14 November"], next: null },
  );
});

test("summaryFromRows finds an upcoming drop named by its month", () => {
  assert.deepEqual(
    summaryFromRows([
      {
        drop_month: "2026-11-01",
        first_date: null,
        last_date: null,
        opens_at: "2026-10-15T18:00:00Z",
        is_open: false,
      },
    ]),
    {
      open: [],
      next: { name: "November", opensAt: "2026-10-15T18:00:00Z" },
    },
  );
});

test("summaryFromRows finds an upcoming drop named by its range", () => {
  assert.deepEqual(
    summaryFromRows([
      {
        drop_month: null,
        first_date: "2026-10-28",
        last_date: "2026-11-10",
        opens_at: "2026-10-15T18:00:00Z",
        is_open: false,
      },
    ]),
    {
      open: [],
      next: { name: "28 October – 10 November", opensAt: "2026-10-15T18:00:00Z" },
    },
  );
});

test("summaryFromRows finds both open drops and the next upcoming drop", () => {
  assert.deepEqual(
    summaryFromRows([
      { drop_month: "2026-10-01", first_date: null, last_date: null, opens_at: null, is_open: true },
      {
        drop_month: "2026-11-01",
        first_date: null,
        last_date: null,
        opens_at: "2026-10-15T18:00:00Z",
        is_open: false,
      },
    ]),
    {
      open: ["October"],
      next: { name: "November", opensAt: "2026-10-15T18:00:00Z" },
    },
  );
});
