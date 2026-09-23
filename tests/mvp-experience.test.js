import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { describeSetup, SETUP_TASKS } from "../src/app/(dashboard)/dashboard/_lib/publication-checks.js";
import { isSetupGuideHiddenOn } from "../src/app/(dashboard)/dashboard/_lib/focused-task-routes.js";
import { normalizeShown } from "../src/app/(site)/discover/queries.js";
import { CheckoutFinePrint } from "../src/app/(public-provider)/[username]/book/[treatmentId]/checkout/_components/checkout-fine-print.jsx";
import {
  customerCancellationFailure,
  customerCancellationSuccess,
  reviewFailure,
} from "../src/app/(account)/account/bookings/_lib/customer-outcomes.js";
import { personalMenuLinks, signInHref } from "../src/components/app-header/personal-menu.js";
import { isBookingPath } from "../src/lib/auth/redirect.js";
import { heldBookingPath } from "../src/lib/bookings/held-booking-path.js";
import { selectPaidAttempt } from "../src/lib/bookings/paid-attempt.js";
import {
  buildBookingEmailContent,
  renderBookingEmailHtml,
  renderBookingEmailText,
} from "../src/lib/emails/booking-email-content.js";
import { legalIdentity } from "../src/lib/legal/identity.js";
import { normalizeUsername, suggestUsername, validateUsername } from "../src/lib/providers/username.js";
import { ratingFromTotals, ratingSummary } from "../src/features/storefront/format.js";

// The final MVP experience (approved 23 September 2026).

const checks = (overrides = {}) => ({
  status: "draft",
  has_business_profile: true,
  has_bookable_treatment: true,
  has_visible_photo: true,
  has_current_location: true,
  has_working_hours: true,
  has_booking_terms: true,
  payments_ready: true,
  agreement_accepted: true,
  meets_publication_requirements: true,
  accepts_new_bookings: false,
  ...overrides,
});

// --- setup guide -------------------------------------------------------------

test("the setup guide counts the eight requirements and names the next one", () => {
  const setup = describeSetup(checks({ has_visible_photo: false, payments_ready: false, meets_publication_requirements: false }));
  assert.equal(setup.total, 8);
  assert.equal(SETUP_TASKS.length, 8);
  assert.equal(setup.doneCount, 6);
  assert.equal(setup.nextTask.id, "portfolio");
  assert.equal(setup.showGuide, true);
  assert.equal(setup.readyToPublish, false);
});

test("the guide disappears when setup is complete, and publishing stays a separate step", () => {
  const setup = describeSetup(checks());
  assert.equal(setup.setupComplete, true);
  assert.equal(setup.showGuide, false);
  assert.equal(setup.readyToPublish, true, "Today shows Ready to publish instead");
  assert.equal(setup.published, false);
});

test("the guide returns on a draft when a requirement lapses, and never shows on a live or suspended page", () => {
  assert.equal(describeSetup(checks({ has_working_hours: false, meets_publication_requirements: false })).showGuide, true);
  assert.equal(describeSetup(checks({ status: "published", has_working_hours: false })).showGuide, false);
  assert.equal(describeSetup(checks({ status: "suspended", has_working_hours: false })).showGuide, false);
  assert.equal(describeSetup(null), null, "no checks, no guide");
});

test("the provider agreement is one of the requirements", () => {
  const setup = describeSetup(checks({ agreement_accepted: false, meets_publication_requirements: false }));
  assert.equal(setup.nextTask.id, "agreement");
  assert.equal(setup.nextTask.href, "/dashboard/settings/payments#provider-agreement");
  assert.equal(setup.readyToPublish, false);
});

test("a live page that stops taking bookings says why, in the order the provider can act", () => {
  const paused = describeSetup(checks({ status: "published", agreement_accepted: false, payments_ready: false, has_booking_terms: false }));
  assert.equal(paused.acceptsNewBookings, false);
  assert.deepEqual(paused.pausedReasons.map((reason) => reason.id), ["agreement", "terms", "payments"]);
  // Everything the page controls is in place: what remains is a balance owed.
  const owing = describeSetup(checks({ status: "published", accepts_new_bookings: false }));
  assert.deepEqual(owing.pausedReasons, [{ id: "balance", label: "Settle the outstanding balance with Ceaute", href: "" }]);
  const live = describeSetup(checks({ status: "published", accepts_new_bookings: true }));
  assert.equal(live.acceptsNewBookings, true);
  assert.deepEqual(live.pausedReasons, []);
});

test("the guide never covers a form, onboarding or the preview", () => {
  for (const pathname of ["/dashboard/treatments/new", "/dashboard/locations/abc/edit", "/dashboard/onboarding", "/dashboard/profile/preview"]) {
    assert.equal(isSetupGuideHiddenOn(pathname), true, pathname);
  }
  for (const pathname of ["/dashboard", "/dashboard/treatments", "/dashboard/settings/payments"]) {
    assert.equal(isSetupGuideHiddenOn(pathname), false, pathname);
  }
});

// --- usernames ---------------------------------------------------------------

test("usernames may contain a full stop between characters", () => {
  assert.equal(validateUsername("studio.nala"), null);
  assert.equal(validateUsername("a.b.c"), null);
  assert.match(validateUsername(".studio"), /can’t come first or last/);
  assert.match(validateUsername("studio."), /can’t come first or last/);
  assert.match(validateUsername("studio..nala"), /one full stop at a time/);
  assert.equal(normalizeUsername("Studio.Nala!"), "studio.nala", "typed full stops are kept, and reported if misplaced");
  assert.equal(suggestUsername("..Studio...Nala.."), "studio.nala", "a suggestion is always valid");
  assert.equal(validateUsername(suggestUsername("Nails by J.")), null);
});

test("the database rule for usernames is the same", () => {
  const migration = readFileSync("supabase/migrations/202609230003_username_full_stops.sql", "utf8");
  assert.ok(migration.includes("username !~ '^[.]'"), "no leading full stop");
  assert.ok(migration.includes("username !~ '[.]$'"), "no trailing full stop");
  assert.ok(migration.includes("username !~ '[.][.]'"), "no two together");
  assert.ok(migration.includes("username ~ '^[a-z0-9._]{3,30}$'"), "length and characters unchanged");
});

// --- navigation ----------------------------------------------------------------

test("the account menu leads customers to My bookings and to starting a business page", () => {
  assert.deepEqual(
    personalMenuLinks({ hasProviderPage: false, isProviderWorkspace: false }).map((link) => link.label),
    ["Discover", "My bookings", "Account", "Start your business page"],
  );
  assert.deepEqual(
    personalMenuLinks({ hasProviderPage: true, isProviderWorkspace: false }).map((link) => link.label),
    ["Your business", "Discover", "My bookings", "Account"],
  );
  assert.equal(
    personalMenuLinks({ hasProviderPage: false, isProviderWorkspace: false }).at(-1).href,
    "/dashboard/onboarding",
  );
});

test("Log in comes back to the page it was pressed on, never to an auth page", () => {
  assert.equal(signInHref("/@studio.nala"), "/sign-in?next=%2F%40studio.nala");
  assert.equal(signInHref("/discover"), "/sign-in?next=%2Fdiscover");
  assert.equal(signInHref("/sign-in"), "/sign-in");
  assert.equal(signInHref("/verify"), "/sign-in");
  assert.equal(signInHref("/"), "/sign-in");
  assert.equal(isBookingPath("/@studio.nala/book/t1/checkout?start_at=x"), true);
  assert.equal(isBookingPath("/account/bookings"), false);
  assert.equal(isBookingPath(null), false);
});

// --- booking journey -------------------------------------------------------------

test("the held page's address carries the hold and the exact selection", () => {
  assert.equal(
    heldBookingPath({ username: "studio.nala", treatmentId: "t1", startAt: "2026-10-01T09:00:00.000Z", addOnIds: ["a1", "a2"], holdId: "h1" }),
    "/@studio.nala/book/t1/checkout?start_at=2026-10-01T09%3A00%3A00.000Z&add_on=a1&add_on=a2&hold=h1",
  );
});

test("only an attempt that took money counts as paid", () => {
  assert.equal(selectPaidAttempt([]), null);
  assert.equal(
    selectPaidAttempt([
      { attempt_number: 1, payment_status: "failed" },
      { attempt_number: 2, payment_status: "checkout_created" },
    ]),
    null,
    "an unpaid hold has no paid attempt, whatever its latest attempt says",
  );
  assert.equal(
    selectPaidAttempt([
      { attempt_number: 3, payment_status: "expired" },
      { attempt_number: 2, payment_status: "refunded" },
      { attempt_number: 1, payment_status: "failed" },
    ]).attempt_number,
    2,
  );
  assert.equal(
    selectPaidAttempt([
      { attempt_number: 1, payment_status: "succeeded" },
      { attempt_number: 2, payment_status: "duplicate_paid" },
    ]).attempt_number,
    1,
    "a duplicate payment is refunded on its own and is not the booking's money",
  );
});

test("checkout names the trader and links the Terms and Privacy Notice before payment", () => {
  const html = renderToStaticMarkup(h(CheckoutFinePrint));
  assert.match(html, /href="\/terms"/);
  assert.match(html, /href="\/privacy"/);
  assert.match(html, /We hold this time for 10 minutes/);
  assert.match(html, /Trader details/);
  assert.ok(html.includes(legalIdentity.operatorName));
  assert.ok(html.includes(legalIdentity.businessAddress));
  assert.ok(html.includes(legalIdentity.contactEmail));
});

test("cancelling and reviewing report their outcome in the customer's words", () => {
  assert.deepEqual(customerCancellationSuccess(3307, "pending"), {
    status: "cancelled",
    message: "Booking cancelled. We’re refunding £33.07 to the card you paid with.",
  });
  assert.equal(customerCancellationSuccess(3307, "succeeded").message, "Booking cancelled. We’ve refunded £33.07 to the card you paid with.");
  // A refund Stripe refused is never reported as on its way.
  for (const status of ["failed", "requires_review"]) {
    const outcome = customerCancellationSuccess(3307, status);
    assert.match(outcome.message, /We couldn’t refund £33\.07 automatically\. Email .+ and we’ll put it right\./);
    assert.doesNotMatch(outcome.message, /refunding/);
  }
  assert.deepEqual(customerCancellationSuccess(0), { status: "cancelled", message: "Booking cancelled." });
  assert.equal(customerCancellationFailure(new Error("Past bookings cannot be cancelled.")).message, "Past bookings cannot be cancelled.");
  assert.match(customerCancellationFailure(new Error("socket hang up")).message, /Refresh to see your booking’s current status/);
  assert.equal(reviewFailure(new Error("Verify your phone number before reviewing.")).message, "Verify your phone number before reviewing.");
  assert.equal(reviewFailure(new Error("permission denied")).message, "We couldn’t save your review. Try again.");
});

// --- late payment email ------------------------------------------------------

const lateEmail = {
  event_type: "late_payment_refunded_customer",
  recipient_role: "customer",
  payload: {
    booking_id: "b1",
    provider_name: "Studio Nala",
    treatment_name: "Gel manicure",
    start_at: "2026-10-01T09:00:00.000Z",
    end_at: "2026-10-01T10:00:00.000Z",
    customer_booking_path: "/account/bookings/b1",
    amount_paid_pence: 1418,
    refund_amount_pence: 1418,
    // Present in some payloads; must never be shown in this email.
    address_line_1: "1 Private Street",
    postcode: "E1 6AN",
  },
};

test("the late-payment email says what happened and what is refunded, without the address or a timing promise", () => {
  const content = buildBookingEmailContent(lateEmail, "https://ceaute.test");
  assert.equal(content.title, "We’re refunding your payment");
  assert.equal(
    content.intro,
    "Your payment for Gel manicure with Studio Nala arrived after your held time ended, so the booking wasn’t made. We’re refunding £14.18 in full to the card you paid with.",
  );
  assert.equal(content.bookingUrl, "https://ceaute.test/account/bookings/b1");

  const text = renderBookingEmailText(lateEmail, "https://ceaute.test");
  const html = renderBookingEmailHtml(lateEmail, "https://ceaute.test");
  for (const rendered of [text, html]) {
    assert.ok(rendered.includes("arrived after your held time ended"));
    assert.doesNotMatch(rendered, /1 Private Street|E1 6AN/);
    assert.doesNotMatch(rendered, /\bwithin\b|working days|\bsoon\b/i);
  }
});

// --- Discover ------------------------------------------------------------------

test("Discover shows 24 more at a time, from ?shown", () => {
  assert.equal(normalizeShown(undefined), 24);
  assert.equal(normalizeShown("48"), 48);
  assert.equal(normalizeShown("50"), 72, "rounded up to whole pages");
  assert.equal(normalizeShown("-5"), 24);
  assert.equal(normalizeShown("abc"), 24);
  assert.equal(normalizeShown("100000"), 480, "one request never asks for everything");
  assert.equal(normalizeShown(["48", "72"]), 48);
});

test("Discover ratings use the storefront's rule, and nothing is invented", () => {
  assert.deepEqual(ratingFromTotals(3, 14), { average: "4.7", count: 3, countLabel: "3 reviews" });
  assert.deepEqual(ratingFromTotals(3, 14), ratingSummary([{ rating: 5 }, { rating: 5 }, { rating: 4 }]));
  assert.equal(ratingFromTotals(0, 0), null, "no reviews shows New");
  assert.equal(ratingFromTotals(null, null), null);
});
