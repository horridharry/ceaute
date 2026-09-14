# Product behaviour

This document answers: **what does Ceaute do today, and which product rules must
an engineer preserve?** It describes the implemented system, not a future
roadmap. Database enforcement is summarised here and explained in
[architecture.md](architecture.md).

## People and provider pages

A Ceaute user has one authenticated account and one profile. The same user may
book as a customer and operate as a provider. A provider is therefore a normal
Ceaute user who has created a provider page; there is no provider account type.

The provider page is the persisted public business or storefront. It has a
stable database ID, which application code calls `providerPageId`, and at most
one page belongs to an account. The database table remains `provider_page` even
when customer-facing copy uses more natural language.

Provider onboarding creates a draft page. Publishing is a PostgreSQL operation,
not merely a UI state change. It requires a display name, username, category and
biography; a complete active location; working hours; at least one active,
categorised treatment; booking and cancellation settings; a visible portfolio
image; and a Stripe recipient account able to receive transfers and payouts.
Suspended pages cannot be published or changed back to draft by their owner.

The provider workspace is `/dashboard`. Profile identity is managed at
`/dashboard/profile`; portfolio and preview are subordinate routes. Locations,
availability, treatments, add-ons, treatment groups, bookings, and settings have
their own dashboard sections. `/dashboard/treatment-groups` is the canonical
group route. `/dashboard/onboarding` is the intentional exception to the normal
guard which redirects dashboard users without a provider page into onboarding.

Customer settings and booking history stay under `/account`, including
`/account/bookings`. Authentication is intentionally asymmetric: sign-in and
sign-up accept a validated return path, while a user without one is sent to the
dashboard if they have a provider page and to the account area otherwise.

## The public page and catalogue

A published provider is available at `/@[username]`. The page shows the public
business identity, public area, visible portfolio images, booking terms, active
treatments, compatible add-ons, and visible reviews. The exact appointment
address is not public.

A treatment is the canonical internal name for the offering a customer books.
Customer prose may say “service”, but code, routes, and domain documentation use
`treatment`. A provider may organise treatments into optional treatment groups.
Those groups are private storefront organisation and are unrelated to Ceaute's
controlled discovery categories.

An add-on increases price, duration, or both. Compatibility is many-to-many, so
one add-on can be offered with several treatments. Archived or inactive
treatments, groups, and add-ons stop appearing in active customer and provider
flows; historical bookings keep their snapshots.

Discovery at `/discover` filters published providers by public-area text and/or
an active Ceaute discovery category. It is a simple category and area search,
not distance search, ranking, recommendations, or a standalone treatment
catalogue.

## Booking and availability

The public journey starts on the provider page. Selecting a treatment goes
directly into its booking flow; there is no separate public `/services`
catalogue or detail route. Compatible add-ons can be selected, then the customer
chooses a time, signs in if necessary, supplies a name and UK phone number,
reviews the terms, and continues to Stripe Checkout.

Availability is derived rather than stored as slot rows. Each provider has at
most one continuous working period per weekday plus whole blocked dates. A slot
must fit the treatment and selected add-on duration inside that period and must
not overlap an active booking or checkout hold.

The current implementation has fixed assumptions which are easy to misread:
starts are generated on 15-minute boundaries, bookings require 24 hours' notice,
the public window is 60 days, and all local calendar calculations use
`Europe/London`. PostgreSQL repeats these rules when a hold is created, so
changing the JavaScript calculator alone does not change the accepted booking
rules. `provider_page.booking_window_days` still exists and accepts 30, 60, or
90, but the current booking flow does not read it. Treat that mismatch as a
known implementation seam, not configurable product behaviour.

Creating a booking first inserts an `awaiting_payment` booking with a five-minute
hold. Starting Stripe Checkout durably records the request and extends the hold
to the Checkout expiry, currently about 31 minutes. Expired holds no longer
block the diary. PostgreSQL's exclusion constraint is the final protection
against overlapping active bookings even when two requests race.

## Payments and booking history

Providers connect a Stripe recipient account. Checkout uses a destination charge
to transfer the booking payment to that account. A provider chooses either full
payment or a fixed deposit and a 12-, 24-, or 48-hour cancellation window. The
deposit or the configured commitment amount is the maximum retained after a
late customer cancellation. Any balance after a fixed deposit is recorded as
due later; collection of that offline balance is outside Ceaute. Checkout
requires the amount due online to be greater than zero.

The current Ceaute platform fee is zero. The payment records and Checkout
payload still carry an explicit fee amount so a later pricing change does not
rewrite historical bookings.

A Stripe return URL is only navigation. It never confirms a booking. The signed
payment webhook checks the Checkout Session, PaymentIntent, currency, amount,
and persisted attempt before an atomic PostgreSQL operation confirms the held
booking. Late or duplicate successful payments are routed into a recorded refund
operation. Webhook events and payment attempts are designed for replay because
Stripe delivery and network outcomes are not exactly-once.

The checkout summary shows the cancellation outcome and any written policy.
There is no separate policy-version record or acceptance checkbox: continuing
to payment is the current acceptance interaction, and the displayed terms are
preserved in the booking snapshot.

The booking snapshots the customer contact details and the selected provider,
treatment, add-ons, price, duration, location, address, booking terms, and
written policy at hold creation. Booking screens, cancellation calculations,
emails, and refunds use that historical contract rather than the provider's
later edits.

The public area can be shown before payment. Exact address and access
instructions are released only in the detail view for a paid confirmed or
completed booking and in confirmation emails. List views, unpaid or expired
holds, and cancellation emails receive redacted snapshots. These privacy rules
are implemented in database functions as well as presentation code.

## Cancellation, completion, and reviews

Only a future confirmed booking can be cancelled. The owning customer and the
owner of the booked provider page have separate authorised paths. A provider
cancellation refunds the full online amount. An early customer cancellation
also refunds the full online amount; a late cancellation retains at most the
snapshotted commitment amount and refunds the rest. Cancellation immediately
releases the appointment interval while the separately recorded refund may still
be pending, retrying, failed, or awaiting manual review.

A protected scheduled route marks confirmed bookings completed after their end
time. The customer attached to a completed booking may leave one 1–5 rating and
an optional comment, unless they own the provider page themselves. Phone
verification was deliberately removed from review eligibility. Visible reviews
appear on the public provider page; visibility can be changed through the
trusted backend, but providers cannot delete reviews.

Transactional confirmation and cancellation email is written to a database
outbox and delivered by a protected scheduled route through Resend. Delivery is
claim-and-retry based. Appointment reminders, SMS, provider replies, distance
search, mobile or virtual appointments, recurring availability exceptions, and
an internal administration UI are not implemented product flows.
