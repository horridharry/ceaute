# 007: Availability is set per date and released in drops

**Status:** Accepted (27 September 2026), with the product owner in a
`ceaute-grill` session.

## Context

All four providers interviewed on 26 September 2026 release their time in
batches ([report](../reports/2026-09-26-provider-interviews.md), theme 1). They
plan the next month privately, announce it on Instagram and open every time at
one moment. Hours differ between dates, even between two Wednesdays in the same
month.

Ceaute's availability was a salon's rolling diary: one working period per
weekday, whole blocked dates and a fixed 60-day window. PostgreSQL enforces
those rules when hours are saved and when a hold is made
([ADR 001](001-postgresql-protects-booking-integrity.md)), so saving hours put
the next 60 days on sale at once. A provider could neither plan privately nor
choose the moment their dates opened. Production had no providers when this was
decided, so no live page depended on the weekly model.

## Decision

- **One model for every provider.** There is no weekly mode and no usual week.
  A provider picks dates and gives them times.
- **Each date has hours or start times.** Hours are one opening and one closing
  time (10 am to 5 pm), and Ceaute offers every start that fits, every 15
  minutes, as it does today. Start times are a list (10 am, 12 pm and 3 pm),
  and only those starts are offered. A date never has both, and never has two
  ranges. Any treatment can begin at a start time if it ends the same day; a
  booking that runs into a later start removes that start.
- **Every date belongs to one drop.** A drop is any group of dates the provider
  picks, usually a month, with one **drop time**: a date and a time in UK time
  on the quarter hour, or now. Ceaute names a drop by its dates ("October",
  "1–14 November"); there is no name to type. A provider can have several
  drops.
- **A drop is private until its drop time.** Its dates are not shown and cannot
  be booked. After the drop time every date in it can be booked, however far
  ahead: there is no booking window.
- **Everything stays editable.** After a drop opens, the provider can add or
  remove dates, change times, or move the drop time later, which hides the
  dates again. Bookings already made never change.
- **Customers see what is open and what is next.** The storefront's
  Availability section shows the open drops and the next drop time instead of
  weekly hours. When nothing is open, the booking screen says when the next
  drop opens, and at the drop time the dates appear without a reload.
- **Publishing needs at least one date from today on with times**, even if its
  drop has not opened, instead of working hours.
- **Weekly hours and blocked dates are deleted when this ships**, not
  converted. A provider who had them has nothing to book until they add a
  drop.
- **Unchanged:** 24 hours' notice, the 15-minute grid, `Europe/London` local
  dates, an appointment ending on the day it starts, the ten-minute hold and
  signing up before it, and PostgreSQL re-validating every hold behind the
  exclusion constraint (ADR 001).
- **Words:** drop, drop time, hours and start times. Ceaute does not say
  "slot": it stores no slots, and works out free starts from bookings
  (ADR 001).
- **Left for later:** the drop kit (idea #6), a share image and link for a
  drop, is its own change straight after this one, trialled with the first
  pilot drop if it is ready. There is no in-app messaging. An email to
  customers when a drop opens, and reminders to the provider, come only if they
  add MVP value, and there is no "always open" option that creates dates by
  itself. These are listed in the product-design skill's
  `references/undecided.md`.

## Consequences

- The hold check in PostgreSQL changes. A start is accepted only on a date in
  a drop whose drop time has passed, and only inside that date's hours or at
  one of its start times. The weekday, blocked-date and 60-day rules go, with
  the weekly-hours and blocked-date tables and functions. The JavaScript
  calculator must agree with the hold check, as ADR 001 requires.
- Anyone, signed in or not, can call the public availability functions, so
  PostgreSQL itself must leave out the dates of a drop that has not opened.
  The next drop time is public, because the storefront shows it.
- Nothing has to run at the drop time. The drop time is compared with the
  clock whenever availability is read or a hold is made, and the storefront and
  booking pages are rendered on every request. Caching either page later would
  have to respect drop times. Waiting booking screens reload themselves at the
  drop time, so every waiting customer reaches the server at once: rehearse a
  drop on Preview before a pilot provider's first.
- Starting Checkout and confirming a payment do not re-check availability. A
  change to a date after a customer's hold was made, including hiding its drop
  again, does not stop that checkout, as with blocked dates today.
- With no window, a provider can open dates as far ahead as they like. A
  deposit can then be held longer before its appointment, and a provider who
  leaves may have more future bookings to honour or refund. Stripe's
  documentation sets no age limit on refunding a card payment (checked
  27 September 2026), and a card dispute over a future service runs from the
  appointment date.
- A provider live with weekly hours when this ships loses them and has nothing
  to book until they add a drop. Tell any pilot provider before the release.
- The database and JavaScript tests for the weekly rule, blocked dates and the
  60-day window are replaced: `mvp_booking_rules`,
  `alpha_consistency_hardening`, `public_projection_publication`,
  `provider_booking_counts` and `publication_checks_and_agreement` in
  `supabase/tests/database/`; `appointment-availability`,
  `availability-schedule-form`, `storefront-opening-hours` and `time-choices`
  in `tests/`.

## Reversibility

High. Dates and drops replace the weekly rules and blocked dates, which are
deleted rather than converted, and every hold is checked against the new
model. Returning to a weekly diary would need a new model, a new hold check and
every provider's availability set up again. Adding to this model is cheap: a
window, several ranges on a date, a usual week that fills dates, an "always
open" option, or drop emails.
