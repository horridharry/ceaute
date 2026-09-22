import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { openingHours, weekdayName } from "../src/features/storefront/opening-hours.js";
import { openingHoursQuery } from "../src/features/storefront/availability-queries.js";
import { formatClockRange, formatClockTime } from "../src/lib/time/clock-time.js";

const REPO_ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const read = (relativePath) => readFileSync(path.join(REPO_ROOT, relativePath), "utf8");
// Comments discuss the rules ("never the exact address"); the code must not.
const readCode = (relativePath) =>
  read(relativePath).replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

// One row exists per day the provider is open; closed days have no row.
const rule = (weekday, starts_at = "09:00:00", ends_at = "17:00:00") => ({
  weekday,
  starts_at,
  ends_at,
});
const days = (list) => list.map((entry) => entry.day);

test("a time of day reads the same for providers and customers", () => {
  assert.equal(formatClockTime("09:00"), "9 am");
  assert.equal(formatClockTime("09:00:00"), "9 am", "database times carry seconds");
  assert.equal(formatClockTime("19:30:00"), "7:30 pm");
  assert.equal(formatClockTime("12:00"), "12 pm");
  assert.equal(formatClockTime("00:00"), "12 am");
  assert.equal(formatClockTime("not a time"), "");
  assert.equal(formatClockRange("10:00:00", "16:30:00"), "10 am to 4:30 pm");
});

test("opening hours list the open days only, Monday to Sunday", () => {
  assert.deepEqual(openingHours([]), [], "no open days, nothing to show");
  assert.deepEqual(openingHours(undefined), []);

  const one = openingHours([rule(3, "10:00:00", "18:00:00")]);
  assert.deepEqual(one, [{ weekday: 3, day: "Wednesday", hours: "10 am to 6 pm" }]);

  // Sunday (0) is the end of the week here, and the rows arrive in any order.
  const several = openingHours([rule(0), rule(5, "09:00:00", "16:00:00"), rule(1)]);
  assert.deepEqual(days(several), ["Monday", "Friday", "Sunday"]);
  assert.deepEqual(
    several.map((entry) => entry.hours),
    ["9 am to 5 pm", "9 am to 4 pm", "9 am to 5 pm"],
  );

  const week = openingHours([0, 1, 2, 3, 4, 5, 6].map((weekday) => rule(weekday)));
  assert.deepEqual(days(week), [
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
    "Sunday",
  ]);
  assert.equal(week.length, 7);
});

test("a day without usable hours is left out rather than shown as closed", () => {
  const shown = openingHours([
    rule(1),
    { weekday: 2, starts_at: null, ends_at: null },
    { weekday: 9, starts_at: "09:00", ends_at: "17:00" },
  ]);
  assert.deepEqual(days(shown), ["Monday"]);
  assert.equal(weekdayName(9), null);
  for (const entry of shown) {
    assert.doesNotMatch(entry.hours, /closed/i);
  }
});

// A stand-in for the Supabase query builder that records each call.
function recordingClient() {
  const calls = {};
  const builder = (table) => {
    const log = (calls[table] = []);
    const chain = new Proxy({}, {
      get: (_, method) => (...args) => {
        log.push([method, ...args]);
        return chain;
      },
    });
    return chain;
  };
  return { calls, client: { schema: () => ({ from: builder }) } };
}

test("opening hours read this page's weekly rules only, never blocked dates", () => {
  const { calls, client } = recordingClient();
  openingHoursQuery(client, "page-1");

  assert.deepEqual(Object.keys(calls), ["availability_rule"], "no other table is read");
  const log = calls.availability_rule;
  const call = (method) => log.filter(([name]) => name === method).map(([, ...args]) => args);
  assert.deepEqual(call("select"), [["weekday, starts_at, ends_at"]]);
  assert.deepEqual(call("eq"), [["provider_page_id", "page-1"]]);

  for (const file of [
    "src/features/storefront/availability-queries.js",
    "src/features/storefront/opening-hours.js",
    "src/features/storefront/storefront-view-model.js",
    "src/features/storefront/storefront-page.jsx",
  ]) {
    const source = readCode(file);
    assert.doesNotMatch(source, /blocked_date|blockedDates/, `${file} never reads blocked dates`);
    assert.doesNotMatch(source, /address_line|postcode|access_instructions/i, `${file} exposes no private location data`);
  }
});

test("Availability is the last section, and only when the provider has open days", () => {
  const storefront = read("src/features/storefront/storefront-page.jsx");
  const section = storefront.slice(
    storefront.indexOf("function Availability"),
    storefront.indexOf("// Storefront sections are separated"),
  );

  assert.match(section, /<h2 className="text-lg font-semibold">Availability<\/h2>/);
  assert.match(section, /\{entry\.day\}[\s\S]*\{entry\.hours\}/, "each open day with its hours");
  assert.doesNotMatch(section, /Today|usual hours|choose a treatment/i, "no today marker or explanatory line");
  assert.doesNotMatch(section, /Closed/, "closed days are absent, not labelled");

  assert.match(storefront, /\{openingHours\.length \? <Availability hours=\{openingHours\} \/> : null\}/);
  const body = storefront.slice(storefront.indexOf("export function StorefrontPage"));
  assert.ok(
    body.indexOf("<ReviewsPreview") < body.indexOf("<Availability"),
    "Availability comes after Reviews",
  );
  assert.ok(
    body.indexOf("<Availability") > body.indexOf("<PaymentTerms"),
    "Booking terms stays where it is, above Availability",
  );
  assert.equal(
    body.slice(body.indexOf("<Availability")).split("</div>")[0].includes("<section"),
    false,
    "nothing follows Availability inside the stack",
  );
});

test("the storefront and the dashboard write times through one helper", () => {
  const scheduleForm = read("src/app/(dashboard)/dashboard/availability/_lib/schedule-form.js");
  assert.match(scheduleForm, /from "@\/lib\/time\/clock-time"/, "the dashboard reuses the shared helper");
  assert.match(scheduleForm, /export const formatSummaryTime = formatClockTime;/);
  assert.match(read("src/features/storefront/opening-hours.js"), /from "@\/lib\/time\/clock-time"/);
  assert.doesNotMatch(
    read("src/features/storefront/opening-hours.js"),
    /dashboard/,
    "public code never imports a dashboard route module",
  );
});
