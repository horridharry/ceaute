import assert from "node:assert/strict";
import test from "node:test";
import {
  dropBaseline,
  dropStatusLine,
  dropSummaryLine,
  formatDateLabel,
  formatDateTimes,
  isDraftDirty,
  namedDrops,
  parseDropForm,
} from "../src/app/(dashboard)/dashboard/availability/_lib/drop-form.js";

// 27 September 2026, 11:00 in London (BST).
const NOW = Date.parse("2026-09-27T10:00:00Z");

const form = (fields) => {
  const formData = new FormData();
  for (const [name, value] of Object.entries(fields)) {
    formData.set(name, typeof value === "string" ? value : JSON.stringify(value));
  }
  return formData;
};

const hoursDate = (localDate, start = "09:00", end = "17:00") => ({
  local_date: localDate,
  hours_start: start,
  hours_end: end,
  start_times: null,
});

const startTimesDate = (localDate, times) => ({
  local_date: localDate,
  hours_start: null,
  hours_end: null,
  start_times: times,
});

test("the long list of every quarter hour is gone", async () => {
  const dropForm = await import(
    "../src/app/(dashboard)/dashboard/availability/_lib/drop-form.js"
  );
  assert.equal(dropForm.TIME_OPTIONS, undefined);
});

test("dropSummaryLine gives the date count and the times every date shares", () => {
  assert.equal(
    dropSummaryLine({
      dates: Array.from({ length: 12 }, (_, index) =>
        hoursDate(`2026-11-${String(index + 1).padStart(2, "0")}`, "10:00", "17:00"),
      ),
    }),
    "12 dates · 10 am to 5 pm",
  );
  assert.equal(
    dropSummaryLine({ dates: [hoursDate("2026-11-01", "09:00:00", "17:30:00")] }),
    "1 date · 9 am to 5:30 pm",
  );
  assert.equal(
    dropSummaryLine({
      dates: [
        startTimesDate("2026-11-01", ["10:00", "12:00", "15:00"]),
        startTimesDate("2026-11-02", ["10:00", "12:00", "15:00"]),
      ],
    }),
    "2 dates · 10 am, 12 pm and 3 pm",
  );
});

test("dropSummaryLine says what kind of times vary when dates differ", () => {
  assert.equal(
    dropSummaryLine({
      dates: [hoursDate("2026-11-01", "10:00", "17:00"), hoursDate("2026-11-02", "09:00", "17:00")],
    }),
    "2 dates · hours vary by date",
  );
  assert.equal(
    dropSummaryLine({
      dates: [
        startTimesDate("2026-11-01", ["10:00"]),
        startTimesDate("2026-11-02", ["10:00", "15:00"]),
      ],
    }),
    "2 dates · start times vary by date",
  );
  assert.equal(
    dropSummaryLine({
      dates: [
        hoursDate("2026-11-01"),
        hoursDate("2026-11-02"),
        hoursDate("2026-11-03"),
        startTimesDate("2026-11-04", ["10:00"]),
        startTimesDate("2026-11-05", ["10:00"]),
      ],
    }),
    "5 dates · 3 with hours, 2 with start times",
  );
  assert.equal(
    dropSummaryLine({
      dates: [hoursDate("2026-11-01"), startTimesDate("2026-11-02", ["10:00"])],
    }),
    "2 dates · 1 with hours, 1 with start times",
  );
});

test("formatDateLabel keeps the blocked-date form, with the year only when it differs", () => {
  assert.equal(formatDateLabel("2026-10-03", "2026-09-27"), "Saturday 3 October");
  assert.equal(formatDateLabel("2027-01-02", "2026-09-27"), "Saturday 2 January 2027");
  assert.equal(formatDateLabel("2026-10-25", "2026-09-27"), "Sunday 25 October");
});

test("parseDropForm reads hours dates for a Now drop, with null opens fields", () => {
  const result = parseDropForm(
    form({
      drop_id: "",
      drop_time: "now",
      opens_on: "",
      opens_time: "",
      dates: [hoursDate("2026-10-02"), hoursDate("2026-10-01", "10:00", "17:30")],
    }),
    NOW,
  );

  assert.deepEqual(result, {
    value: {
      dropId: null,
      opensOn: null,
      opensTime: null,
      dates: [hoursDate("2026-10-01", "10:00", "17:30"), hoursDate("2026-10-02")],
    },
  });
});

test("parseDropForm reads start times, sorted and without repeats", () => {
  const result = parseDropForm(
    form({
      drop_id: "drop-1",
      drop_time: "now",
      dates: [
        {
          local_date: "2026-10-01",
          hours_start: null,
          hours_end: null,
          start_times: ["15:00", "10:00", "12:00", "10:00"],
        },
      ],
    }),
    NOW,
  );

  assert.deepEqual(result.value.dates, [
    {
      local_date: "2026-10-01",
      hours_start: null,
      hours_end: null,
      start_times: ["10:00", "12:00", "15:00"],
    },
  ]);
  assert.equal(result.value.dropId, "drop-1");
});

test("parseDropForm refuses a date without times", () => {
  const result = parseDropForm(
    form({
      drop_time: "now",
      dates: [
        hoursDate("2026-10-01"),
        { local_date: "2026-10-02", hours_start: null, hours_end: null, start_times: null },
      ],
    }),
    NOW,
  );

  assert.deepEqual(result, { error: "Add times for every date." });
});

test("parseDropForm refuses closing before opening and times off the quarter hour", () => {
  const message = "Choose 15-minute opening and closing times, with closing after opening.";

  assert.deepEqual(
    parseDropForm(form({ drop_time: "now", dates: [hoursDate("2026-10-01", "17:00", "09:00")] }), NOW),
    { error: message },
  );
  assert.deepEqual(
    parseDropForm(form({ drop_time: "now", dates: [hoursDate("2026-10-01", "09:00", "09:00")] }), NOW),
    { error: message },
  );
  assert.deepEqual(
    parseDropForm(form({ drop_time: "now", dates: [hoursDate("2026-10-01", "09:10", "17:00")] }), NOW),
    { error: message },
  );
  assert.deepEqual(
    parseDropForm(
      form({
        drop_time: "now",
        dates: [{ local_date: "2026-10-01", start_times: ["10:05"] }],
      }),
      NOW,
    ),
    { error: message },
  );
});

test("parseDropForm asks for both fields when Later is incomplete", () => {
  const message = "Choose a date and time for Later.";
  const dates = [hoursDate("2026-10-01")];

  assert.deepEqual(
    parseDropForm(form({ drop_time: "later", opens_on: "", opens_time: "19:00", dates }), NOW),
    { error: message },
  );
  assert.deepEqual(
    parseDropForm(form({ drop_time: "later", opens_on: "2026-10-15", opens_time: "", dates }), NOW),
    { error: message },
  );
});

test("parseDropForm refuses a Later time that has passed", () => {
  const dates = [hoursDate("2026-10-01")];

  // 11:00 London is exactly now; 10:45 London is before it.
  for (const opensTime of ["11:00", "10:45"]) {
    assert.deepEqual(
      parseDropForm(form({ drop_time: "later", opens_on: "2026-09-27", opens_time: opensTime, dates }), NOW),
      { error: "That time has passed. Choose a later drop time." },
    );
  }

  assert.deepEqual(
    parseDropForm(form({ drop_time: "later", opens_on: "2026-09-27", opens_time: "11:15", dates }), NOW).value,
    { dropId: null, opensOn: "2026-09-27", opensTime: "11:15", dates },
  );
});

test("formatDateTimes writes hours as a range and start times as a list", () => {
  assert.equal(formatDateTimes(hoursDate("2026-10-01", "10:00", "17:00")), "10 am to 5 pm");
  assert.equal(
    formatDateTimes({ local_date: "2026-10-01", start_times: ["10:00", "12:00", "15:00"] }),
    "10 am, 12 pm and 3 pm",
  );
  assert.equal(
    formatDateTimes({ local_date: "2026-10-01", start_times: ["10:00", "15:30"] }),
    "10 am and 3:30 pm",
  );
  assert.equal(formatDateTimes({ local_date: "2026-10-01", start_times: ["10:00"] }), "10 am");
});

test("dropStatusLine says a drop is open or when it opens", () => {
  assert.equal(dropStatusLine({ opensAt: "2026-09-27T09:00:00Z" }, NOW), "Slots open for booking");
  assert.equal(dropStatusLine({ opensAt: "2026-09-27T10:00:00Z" }, NOW), "Slots open for booking");
  assert.equal(
    dropStatusLine({ opensAt: "2026-10-15T18:00:00Z" }, NOW),
    "Slots open on 15 October at 7 pm",
  );
});

test("namedDrops names by month unless another drop shares that month", () => {
  const october = { id: "a", opensAt: "", dates: [hoursDate("2026-10-01"), hoursDate("2026-10-20")] };
  const earlyNovember = { id: "b", opensAt: "", dates: [hoursDate("2026-11-01"), hoursDate("2026-11-14")] };
  const lateNovember = { id: "c", opensAt: "", dates: [hoursDate("2026-11-15"), hoursDate("2026-11-30")] };
  const across = { id: "d", opensAt: "", dates: [hoursDate("2026-12-28"), hoursDate("2027-01-10")] };

  const names = namedDrops([october, earlyNovember, lateNovember, across]).map((drop) => drop.name);

  assert.deepEqual(names, ["October", "1–14 November", "15–30 November", "28 December – 10 January"]);
});

test("namedDrops counts a drop spanning months as sharing the months it touches", () => {
  const across = { id: "a", opensAt: "", dates: [hoursDate("2026-10-28"), hoursDate("2026-11-10")] };
  const november = { id: "b", opensAt: "", dates: [hoursDate("2026-11-20"), hoursDate("2026-11-25")] };
  const [first, second] = namedDrops([across, november]);

  assert.equal(first.name, "28 October – 10 November");
  assert.equal(first.firstDate, "2026-10-28");
  assert.equal(first.lastDate, "2026-11-10");
  assert.equal(second.name, "20–25 November");
});

test("dropBaseline starts a new drop empty at Now", () => {
  assert.deepEqual(dropBaseline(null, NOW), {
    dates: [],
    drop_time: "now",
    opens_on: "",
    opens_time: "",
  });
});

test("dropBaseline keeps an open drop at Now, so saving an edit keeps it open", () => {
  const drop = { id: "a", opensAt: "2026-09-20T18:00:00Z", dates: [hoursDate("2026-10-01")] };

  assert.deepEqual(dropBaseline(drop, NOW), {
    dates: [hoursDate("2026-10-01")],
    drop_time: "now",
    opens_on: "",
    opens_time: "",
  });
});

test("dropBaseline starts an upcoming drop at Later with its London date and time", () => {
  const bst = { id: "a", opensAt: "2026-10-15T18:00:00+00:00", dates: [hoursDate("2026-11-01")] };
  const gmt = { id: "b", opensAt: "2026-11-15T19:30:00Z", dates: [hoursDate("2026-12-01")] };

  assert.deepEqual(dropBaseline(bst, NOW), {
    dates: [hoursDate("2026-11-01")],
    drop_time: "later",
    opens_on: "2026-10-15",
    opens_time: "19:00",
  });
  assert.equal(dropBaseline(gmt, NOW).opens_on, "2026-11-15");
  assert.equal(dropBaseline(gmt, NOW).opens_time, "19:30");
});

test("isDraftDirty notices dates, times and drop time, and ignores Later fields under Now", () => {
  const baseline = {
    dates: [hoursDate("2026-10-01")],
    drop_time: "now",
    opens_on: "",
    opens_time: "",
  };

  assert.equal(isDraftDirty({ ...baseline }, baseline), false);
  assert.equal(isDraftDirty({ ...baseline, opens_on: "2026-10-15" }, baseline), false);
  assert.equal(
    isDraftDirty({ ...baseline, dates: [hoursDate("2026-10-01", "10:00", "17:00")] }, baseline),
    true,
  );
  assert.equal(
    isDraftDirty({ ...baseline, dates: [...baseline.dates, hoursDate("2026-10-02")] }, baseline),
    true,
  );
  assert.equal(isDraftDirty({ ...baseline, dates: [] }, baseline), true);
  assert.equal(isDraftDirty({ ...baseline, drop_time: "later" }, baseline), true);
});
