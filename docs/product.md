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
biography; a complete current location; working hours; at least one active,
categorised treatment; booking and cancellation settings; a visible portfolio
image; and a Stripe recipient account able to receive transfers and payouts.
A published page keeps its username: the owner must unpublish before clearing
it, and PostgreSQL rejects the change otherwise. The outcome of publishing or
unpublishing, including the database's rejection reason, is shown on the
profile screen. Suspended pages cannot be published or changed back to draft
by their owner.

The provider workspace is `/dashboard`. Each provider-management area is an
independent section with its own page and heading: Home, Bookings,
Availability, Locations, Treatments, Treatment groups, Add-ons, Profile,
Portfolio, Booking settings and Payments. The header's menu button opens them
as one flat list in that order (`src/components/app-header/provider-menu.js`);
its unlabelled dividers are scanning aids, not groups, and URL nesting
(Portfolio under `/dashboard/profile`, the two settings pages under
`/dashboard/settings`) implies no product hierarchy. After the sections,
View your page opens the live `/@username` page once published, otherwise
`/dashboard/profile/preview`, which is marked as not live and redirects to the
live page after publishing. `/dashboard/settings` redirects to `/dashboard`.
The personal control is the person rather than the business: Account, My
bookings (bookings they made as a customer) and Discover inside the workspace,
Your business, Bookings and Account outside it. `/dashboard/treatment-groups`
is the canonical group route. `/dashboard/onboarding` is the intentional exception to the normal
guard which redirects dashboard users without a provider page into onboarding.

Customer settings and booking history stay under `/account`, including
`/account/bookings`. The settings screen edits the profile name and UK phone
number that bookings snapshot; email is the sign-in identity and is not
editable there, and there is no account deletion flow. Signing in and signing
up both email a six-digit code which the person types into Ceaute; there is no
link to click. Sign-in never creates an account, sign-up may, a new code can be
requested once a minute, and requesting one cancels the previous code.
Authentication is intentionally asymmetric: sign-in and
sign-up accept a validated return path, which survives the code screen so an
interrupted booking resumes at its checkout, while a user without one is sent to the
dashboard if they have a provider page and to the account area otherwise.

## The public page, treatments, treatment groups and add-ons

A published provider is available at `/@[username]`. On phones and tablets it
opens with a hero carousel of every visible portfolio image in portfolio order
(swipe, with compact pagination dots); tapping the image in view opens the
gallery at that photo, and a swipe never does. On wide screens the hero is a
Bento grid wider than the page column: one prominent photo and up to four
supporting ones, each opening the gallery at that photo, with "Show all
photos" at the bottom right. Then comes the identity: the optional display
photo, business name, `@username` with the public area, and the average rating
with review count (or a "New" pill before the first visible review). The
provider category is not shown publicly there. Below that it shows a Portfolio
preview of the first three visible photos (the first repeats the hero on
purpose) with "See all photos", then a Treatments preview, booking terms and
visible reviews. The exact appointment address is not public.

The Treatments preview shows the first three active treatments in page order,
across groups and without group headings, with "See all treatments" when there
are more than three; with none, the section is left out. `/@[username]/treatments`
(All treatments) lists every active treatment under its group's name, groups
in order and treatments without an active group last (headed "Other
treatments" when other groups are shown). When at least two groups have
treatments, filter pills ("All", then one per group) show one group at a time;
the choice is page state, not part of the URL. Both pages open the same
details sheet, add-on choice and booking link, and unpublished or unknown
providers have no All treatments page (a real 404). The owner's preview shows
the same three treatments without booking or "See all treatments".

Page order is: groups by display order, then name; treatments by display
order, then most recently updated first; add-ons by display order, then name;
each finally by id so ties are stable. Providers cannot yet set display order
(every row keeps the default), so today groups appear alphabetically and the
most recently edited treatment first. Provider-controlled reordering of
treatments and groups is deferred to a later stage. The display photo is managed in Profile, is stored separately from
Portfolio, and is not a publication requirement; the page leaves it out when
there is none. Link previews use the hero's first image, served at
`/@[username]/og-image` only for a published page.

`/@[username]/photos` is the gallery: every visible portfolio photo in
portfolio order in a Bento grid, and a full-screen viewer (swipe,
Previous/Next, arrow keys, Escape) opened at a photo with `?photo=<id>`.
Unpublished and unknown providers have no gallery (a real 404). The owner's
unpublished preview has no gallery links. On the provider's Portfolio page,
each photo opens the same viewer; managing photos stays there.

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

## Where a provider works

A provider saves a list of locations at `/dashboard/locations` and marks exactly
one of them as the one they are working from now. The public page, discovery and
every new booking use that one. A customer never chooses between a provider's
saved locations; they do not see that there is more than one.

Moving is a deliberate act. PostgreSQL moves the flag and, in the same
transaction, retires any unpaid hold that was taken against the location being
left, so a customer cannot end up with an appointment at an address the provider
has just left. A hold retired this way behaves exactly like one that ran out of
time: the checkout screen says the booking is no longer payable, and a payment
that lands anyway becomes a full refund entitlement instead of a booking.

One window stays open, deliberately. A customer who already had Stripe Checkout
in front of them when the provider moved can still pay, for as long as that
Session lives. They are charged and then fully refunded through the existing
late-payment path; they never get a booking at the old address. Closing the
window would mean expiring Stripe Sessions from the locations screen, which
would make a provider's own dashboard depend on Stripe being reachable. Charging
and refunding in that narrow case is the accepted trade-off.

Bookings already confirmed are untouched. A confirmed booking keeps the address
the customer agreed to, and the provider honours it or cancels it through the
existing cancellation path. Ceaute does not notify customers that a provider has
moved, does not cancel their bookings for them, and does not stop a provider
moving because future bookings exist.

The location a provider is currently working from cannot be deleted; a provider
makes another saved location current first. Any other saved location can be
deleted outright, and nothing is archived. Historical bookings survive that
deletion because each booking snapshotted its own address when the hold was
taken.

Search results can lag a move, because discovery reads are cached like every
other page. Opening the provider's page shows where they are working now. That
staleness is an accepted MVP trade-off, not a bug to design around.

## Booking and availability

The public journey starts on the provider page. Selecting a treatment goes
directly into its booking flow; there is no separate public `/services`
catalogue or detail route. Compatible add-ons can be selected, then the customer
chooses a time, signs in if necessary, supplies a name and UK phone number, and
lands on the held booking, where they review the terms, optionally attach
inspiration images, and continue to Stripe Checkout.

Availability is derived rather than stored as slot rows. Each provider has at
most one continuous working period per weekday plus whole blocked dates. A slot
must fit the treatment and selected add-on duration inside that period and must
not overlap an active booking or checkout hold.

The current implementation has fixed rules which are easy to misread. Working
period boundaries and appointment starts use a 15-minute grid, while treatment
and add-on durations can be any whole number of minutes. Bookings require 24
hours' notice, customers can book up to 60 days ahead, and all local calendar
calculations use `Europe/London`. PostgreSQL enforces these rules when working
hours are saved and when a hold is created, so changing the JavaScript
calculator alone does not change the accepted booking rules. The booking window
is not provider-configurable; the legacy `provider_page.booking_window_days`
column is unused and providers cannot change it.

Providers manage availability at `/dashboard/availability`. Weekdays show as
summary rows ("Monday 9 am to 5 pm", "Wednesday Closed") that expand in place
for editing; the week is edited as a draft and saved together with one Save
hours action, whose bar appears only while there are unsaved changes. Leaving
with unsaved hours asks first, whether through Ceaute's links or browser
back/forward; reload and closing the tab use the browser's own prompt, which iOS
Safari never shows, so those two cases are unprotected on iPhone (a browser
limitation). A published provider who saves a week with every day closed is
asked to confirm; the page stays published but takes no new bookings, and a
banner says so. Blocked dates are added one at a time and removed immediately,
separately from weekly hours. Blocking a date never cancels or changes existing
bookings: confirmed bookings stay, and a checkout already in progress may still
complete, while no new hold can start on a blocked date. The screen shows
confirmed bookings and payments in progress per date, read once when the page
loads; the counts are advisory and the database rules decide what can be booked.

Creating a booking first inserts an `awaiting_payment` booking with a five-minute
hold. Starting Stripe Checkout durably records the request and extends the hold
to the Checkout expiry, currently about 31 minutes. Expired holds no longer
block the diary. PostgreSQL's exclusion constraint is the final protection
against overlapping active bookings even when two requests race.

## Inspiration images

A customer may attach private reference pictures to their own booking, to show
the provider the result they are after. The step sits on the held-booking
checkout screen between the summary and the payment button, and it is optional
in the strongest sense: nothing about payment depends on it, and the payment
button is there whether or not an image has been added.

A booking carries at most five images, each a JPEG, PNG or WebP of no more than
10 MB. The screen says so before an upload starts, but the limits that decide
are the Storage bucket's own and the table's own, so a request that skips the
screen is refused just the same. The five numbered places per booking are why a
sixth image cannot be added even by two uploads racing each other.

The images belong to the customer. While the appointment is still ahead of them
they may add, view and remove; once it is completed or cancelled the images
become read-only and stay with the historical booking. The provider sees the
images for an appointment they were actually engaged for, and only sees them —
they cannot add, remove or replace a customer's pictures. Nobody else sees them
at all. The bucket is private and reached through short-lived signed URLs, so
there is no permanent public address for an image.

Images attached to a booking that is never paid for are temporary. When the hold
runs out or the booking is cancelled before it was ever confirmed, the scheduled
booking-lifecycle route deletes both the files and their records, so entering
the booking flow and walking away leaves nothing behind. Images on a booking
that was paid for are kept with it; Ceaute has no retention or deletion policy
for those yet, and that is deliberately deferred.

## Payments and booking history

Providers connect a Stripe recipient account. Checkout uses a destination charge
to transfer the booking payment to that account. A provider chooses either full
payment or a fixed deposit and a 12-, 24-, or 48-hour cancellation window. The
deposit or the configured commitment amount is the maximum retained after a
late customer cancellation. Any balance after a fixed deposit is recorded as
due later; collection of that offline balance is outside Ceaute. There is no
pay-later option, so a deposit must be greater than £0; PostgreSQL rejects a
deposit-mode setting without one. Checkout still requires the amount due online
to be greater than zero.

The customer pays the advertised price; the provider bears both deductions.
Stripe's `application_fee_amount` is the only lever, so it carries Ceaute's 2%
platform fee *and* the estimated Stripe processing cost together — the
connected account is configured with `fees_collector: "application"`, so Stripe
debits its own fee from Ceaute's balance whatever the split says. The provider
receives the remainder. Only money processed through Ceaute is charged for; a
deposit booking's offline balance never is.

Stripe's actual fee depends on the card and is not knowable when the split is
fixed at Checkout creation, so the processing component is an estimate at
Stripe's published UK rate and Ceaute absorbs the difference either way. The
payment records carry the fee per attempt so a later pricing change does not
rewrite historical bookings. See
[decision 004](decisions/004-providers-bear-stripe-processing-fees.md).

A Stripe return URL is only navigation. It never confirms a booking. The signed
payment webhook checks the Checkout Session, PaymentIntent, currency, amount,
and persisted attempt before an atomic PostgreSQL operation confirms the held
booking. Late or duplicate successful payments are routed into a recorded refund
operation. Webhook events and payment attempts are designed for replay because
Stripe delivery and network outcomes are not exactly-once.

Both checkout steps show the cancellation window, the amount the provider
retains after a late cancellation, and any written policy, and both link to
`/terms` and `/privacy`. There is no separate policy-version record or
acceptance checkbox: continuing to payment is the current acceptance
interaction, and the displayed terms are preserved in the booking snapshot.

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
be pending, retrying, failed, or awaiting manual review. A scheduled recovery
pass retries refund operations that were recorded but never completed, so a
Stripe outage during cancellation delays a refund rather than losing it.

A protected scheduled route marks confirmed bookings completed after their end
time. The customer attached to a completed booking may leave one 1–5 rating and
an optional comment, unless they own the provider page themselves. Phone
verification was deliberately removed from review eligibility. Visible reviews
appear on the public provider page. A database function lets the trusted
backend hide or show a review, but no application or administration screen
calls it yet, and nobody can delete a review.

A provider must accept the current provider agreement before their page can
take paid bookings, and an acceptance is recorded immutably against its version
string. A provider carrying an outstanding liability is also blocked from new
paid bookings until it is settled; existing confirmed bookings are unaffected.
Both gates are evaluated where the Stripe-readiness gate already is, at the
point Checkout would be created, and the customer sees the same neutral
"cannot take online payments right now" notice either way.

A customer can dispute a payment with their bank. Ceaute records every
`charge.dispute.*` event in `booking_dispute`, joined to the booking through
its PaymentIntent, and emails the operator when a dispute opens, has funds
withdrawn or reinstated, or closes. `GET /api/operator/disputes` lists open
disputes for whoever holds the operator secret. Nothing is automatic beyond
that: no transfer is reversed, no provider is debited, no evidence is
submitted, and providers are not told. When an operator decides a lost dispute
was the provider's responsibility, the reversed amount is recorded in
`provider_liability`; an operator can then reverse the transfer for whatever
the connected account can still cover, and whatever Stripe cannot reach stays
recorded as outstanding debt. Stripe's dispute fee is never recorded as
provider debt. Responding happens by hand in Stripe —
see [the dispute runbook](dispute-response.md).

Transactional confirmation and cancellation email is written to a database
outbox and delivered by a protected scheduled route through Resend. Delivery is
claim-and-retry based. Appointment reminders, SMS, provider replies, distance
search, mobile or virtual appointments, recurring availability exceptions, and
an internal administration UI are not implemented product flows.
