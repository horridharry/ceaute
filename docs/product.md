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

Starting a business page ("Start your business page" in the account menu or
Account → Your business) asks only for a business name and a username, creates
a draft page and opens the dashboard; it never updates an existing page. A
username is 3–30 lowercase letters, numbers, underscores and full stops; a full
stop sits between characters (`studio.nala`), never first, last or twice in a
row, and usernames are unique ignoring case. Existing usernames are never
rewritten.

Publishing is a PostgreSQL operation, not merely a UI state change. It requires
eight things, read from one breakdown
(`ceaute.get_provider_page_publication_checks`): a business profile (name,
username, category; the bio is optional), an active categorised treatment priced
at least £1.00, a visible portfolio photo, a complete current location, working
hours, complete booking terms (a percentage, see Payments), a Stripe recipient
account able to receive transfers and payouts, and acceptance of the current
provider agreement. Treatment descriptions and treatment groups are optional.

Setup completion, readiness, publication, taking bookings and suspension are
separate. A draft with anything left to do shows the setup guide on every
dashboard page except create and edit screens, onboarding and the preview:
pinned to the bottom on phones, floating at the bottom right from 640px, "3 of
8" with the next task, expanding to a full-screen sheet on phones or a panel on
larger screens. It is derived on each request and never stored, disappears when
setup is complete and returns if a requirement lapses on a draft. Today then
shows a small Ready to publish card. Publishing stays deliberate, on
Settings → Publication. A published page whose terms, Stripe account or
agreement acceptance lapse, or whose owner owes Ceaute money, stays published
and visible but takes no new bookings
(`ceaute.provider_page_accepts_new_bookings`); Today, Booking settings and
Publication say why, and the public page says it "isn't taking online bookings
right now" and shows no Book buttons. Ceaute never unpublishes a page by itself.
A published page keeps its username: the owner must unpublish before clearing
it, and PostgreSQL rejects the change otherwise. The outcome of publishing or
unpublishing, including the database's rejection reason, is shown on
Settings → Publication (`/dashboard/settings/publication`), the only place a
provider publishes or unpublishes. It lists each unmet requirement with a link
to the section where it is met; Profile has no publication controls. Suspended
pages cannot be published or changed back to draft by their owner.

The provider workspace is `/dashboard`. Each provider-management area is an
independent section with its own page and heading: Home, Bookings,
Availability, Locations, Treatments, Treatment groups, Add-ons, Profile,
Portfolio, Booking settings, Payments and Publication. The header's menu button opens them
as one flat list in that order (`src/components/app-header/provider-menu.js`);
its unlabelled dividers are scanning aids, not groups, and URL nesting
(Portfolio under `/dashboard/profile`, the two settings pages under
`/dashboard/settings`) implies no product hierarchy. After the sections,
View your page opens the live `/@username` page once published, otherwise
`/dashboard/profile/preview`, which is marked as not live, links to
Publication, and redirects to the live page after publishing. `/dashboard/settings` redirects to `/dashboard`.
The personal control is the person rather than the business. For every
signed-in account it lists, in constant positions, Account, My bookings
(bookings they made as a customer) and Discover, then one business slot (Your
business, or Start your business page for someone without a page), then Log
out; the row for the area you are in is marked (approved 23 September 2026).
Provider pages show a quiet "Business" label beside the logo; the header is
otherwise the same. Its initial comes from the profile name. Signed out, the header's Log in returns to
the page it was pressed on. Customers' bookings are "My bookings"; the
provider's are "Bookings". `/dashboard/treatment-groups`
is the canonical group route. `/dashboard/onboarding` is the intentional exception to the normal
guard which redirects dashboard users without a provider page into onboarding.

The provider's Bookings section shows appointments only, under Upcoming,
Completed (finished, whether or not the completion job has run) and Cancelled.
Each appointment is a card (on Home too, without money): time and customer
first, then the treatment and inspiration photo count. A card states money only
where the booking's figures prove it: "To collect £X", or "Paid in full" when
the online payment is the whole price; a cancelled card shows who cancelled and
the refund's actual state (Refunded £X only once refunded, otherwise Refund
pending, Refund failed or No refund). The filter pills switch views instantly
on the device; each choice is a browser history entry, so `?view=` links,
reloads, Back and Forward work. My bookings works the same way in customer
wording. Booking details, for both sides, open with the appointment (when,
what, where and the one amount that matters now) and its actions; the full
breakdown of prices, payment, amount to collect and refund state follows in
Payment. There is no Get directions action.
Unpaid holds, expired holds and holds whose late payment was refunded are left
out of every list and count, and their detail URLs are Not found, decided on the
server; the records are kept. Availability's count of payments in progress is
unchanged. Home (Today) lists the day's appointments, a Ready to publish card
when a draft's setup is complete, and a notice when a live page is not taking
new bookings.

`/account` is the Account page (`/account/settings` redirects to it): Personal
details (the profile name and UK phone number that bookings snapshot, saved
with a neutral "Saved"), Signing in (the email, which is the sign-in identity
and is not editable, and Log out), Your business (a way into the dashboard, or
Start your business page) and Your data (requests are emailed to the legal
contact address, as the Privacy Notice describes; there is no self-service
deletion). My bookings is `/account/bookings`. Signing in and signing
up both email a six-digit code which the person types into Ceaute; there is no
link to click. Sign-in never creates an account, sign-up may, a new code can be
requested once a minute, and requesting one cancels the previous code.
Authentication is intentionally asymmetric: sign-in and
sign-up accept a validated return path, which survives the code screen so an
interrupted booking resumes at Review and pay (the form says so when the
return path is a booking), while a user without one is sent to the
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
purpose) with a "See all N photos" text link beside the heading, then a
Treatments preview, the three newest visible reviews and, last, Availability.
The storefront has no Booking terms section: a customer sees the payment,
cancellation window, late-cancellation outcome and written policy at booking
review, before paying. The exact appointment address is not public.

The Treatments preview shows the first three active treatments in page order,
across groups and without group headings, followed by a full-width "See all N
treatments" button counting every active treatment; with none, the section is
left out. A treatment card (revised 23 September 2026) reads: its name, the
description on one line, then the price and an add-on count ("2 add-ons") with
a filled black Book at the end of that row on every card. Book, like tapping
the card, opens the details sheet for every treatment: the whole description,
duration, price and any add-ons, then "Choose a time".

Reviews show the three newest publicly visible reviews in bordered cards,
followed by a full-width "See all N reviews" button counting every visible
one. With no visible reviews the section and its button are left out.
`/@[username]/reviews` (All reviews) lists every visible review, newest
first, under the same average rating and count the identity section shows,
with no filters, sorting or pagination; unpublished and unknown providers
have no All reviews page (a real 404). Reviews written in the same second are
ordered by their id so the order never shifts between requests. A review
carries only its rating, comment, date and the reviewer's first name, derived
on the server; a reviewer with no name reads as "Verified customer". Hiding a
review removes it from the page, the count and the average at once.

Availability is the last section: the provider's normal weekly opening hours,
open days only, Monday to Sunday, written the same way as on their own
Availability screen ("9 am to 5 pm"). Closed days, blocked dates, holiday
exceptions, a today marker and any explanation of bookable times are all left
out, and the section disappears when the provider has no open days. These
hours describe when the provider works, not which appointments are free: the
booking journey remains the only source of bookable times.
`/@[username]/treatments`
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
Previous/Next, arrow keys, Escape) opened at a photo with `?photo=<id>`, which
changes through browser history without a server round trip.
Unpublished and unknown providers have no gallery (a real 404). The owner's
unpublished preview has no gallery links. On the provider's Portfolio page,
each photo opens the same viewer; managing photos stays there. Every photo
deletion is confirmed, and the database record is removed before the stored
file. While the page is published, its last visible photo cannot be hidden or
deleted: PostgreSQL rejects the change (locking the page row so two concurrent
requests cannot both pass), and publishing is never undone as a side effect.

A treatment is the canonical internal name for the offering a customer books.
Customer prose may say “service”, but code, routes, and domain documentation use
`treatment`. A provider may organise treatments into optional treatment groups.
Those groups are private storefront organisation and are unrelated to Ceaute's
controlled discovery categories.

An add-on increases price, duration, or both. Compatibility is many-to-many, so
one add-on can be offered with several treatments. Archived or inactive
treatments, groups, and add-ons stop appearing in active customer and provider
flows; historical bookings keep their snapshots.

Add-ons and treatment groups are soft-deleted. Each is Active, Archived or
Deleted, and the only changes are Active→Archived, Archived→Active and
Archived→Deleted, made by PostgreSQL functions that check ownership; deleting an
active record is rejected. A deleted record disappears from both the Active and
Archived lists, the public page and booking, and its name can be reused. A
deleted add-on keeps its treatment links internally. A group cannot be archived
or deleted while any treatment, archived ones included, still uses it; the
dashboard explains why and links to those treatments, and nothing is moved
automatically. An archived group cannot be newly assigned, but a treatment
already in one keeps it and its edit form shows the group as archived. Saving an
add-on keeps its links to archived treatments and cannot create new ones.

Discovery at `/discover` lists every published provider with a current
location and an active treatment, alphabetically, 24 at a time ("Show more"
adds 24 through `?shown=`, without JavaScript), and filters them by public-area
text and/or an active Ceaute discovery category. Each card (revised
23 September 2026) shows up to three portfolio photos as one large swipeable
photo (4:5, approved) with dots, then the display photo, business name,
public area and the storefront's rating (average of visible reviews to one
decimal with the count, or the plain word "New"). The business name is the
card's link; each photo also opens the storefront on a tap, never on a swipe,
and the previous and next buttons are separate controls. It is a simple
category and area search, not distance search, ranking, recommendations, or a
standalone treatment catalogue. There is no landing page: `/` redirects (temporarily) to
`/discover`, and the header logo leads to Discover everywhere except the
provider workspace, where it leads to the dashboard.

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
chooses a time on "When suits you?" (revised 23 September 2026): a treatment
summary card, the month as a heading, a strip of day cards (abbreviated weekday
and date; closed and fully booked days look different and say "Closed" or
"Full"), the chosen day ("Friday 25"), and its times in two columns, 24-hour,
grouped Morning, Afternoon and Evening. The days and times are the
calculator's, which mirrors the hold rules: 24 hours' notice, a fixed 60-day
window (the unused `booking_window_days` column never drives it) and the
15-minute start grid. Review and pay is readable
before signing in: the summary, what is paid now and at the appointment (from
PostgreSQL's quote), the cancellation deadline and what a late cancellation
keeps, the written policy, and the customer's saved contact details as one line
with Change. Signing in returns to the same Review. "Continue to payment" is
one server action: it saves changed details, continues with the customer's own
matching live hold or makes a new one, checks the held amounts equal what was
reviewed (stopping on "Check the updated price" if the provider changed
something), and opens Stripe Checkout. A different hold of the customer's own
at an overlapping time is linked, never silently replaced.

Stripe returns to the held page, which only reads state: a confirmed booking
opens its page with "You're booked" and the address; "Confirming your
payment…" refreshes every 3 seconds for a minute and never offers to pay again;
a payment that arrived after the hold ended reads "We couldn't book this time"
with the full refund's state; a failed, cancelled or unfinished payment keeps
"Continue to payment" while the time is held; an ended hold with nothing paid
says so; a provider who stopped taking bookings is named and nothing is
charged.

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

Creating a booking first inserts an `awaiting_payment` booking with a ten-minute
hold, refused if the provider is not taking bookings. Starting Stripe Checkout
durably records the request and extends the hold to the Checkout expiry,
currently about 31 minutes; a rejected or unusable Session restores the
original expiry. Expired holds no longer
block the diary. PostgreSQL's exclusion constraint is the final protection
against overlapping active bookings even when two requests race.

## Inspiration images

A customer may attach private reference pictures to their own booking, to show
the provider the result they are after. They are added after the booking is
confirmed, from the booking's page ("Add inspiration photos"), until the
appointment starts; nothing about booking or paying depends on them.

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

Images attached to a booking that is never paid for are temporary. The screens
no longer offer them before confirmation, and the scheduled booking-lifecycle
route still deletes the files and records of any hold that runs out or is
cancelled before it was ever confirmed. Images on a booking
that was paid for are kept with it; Ceaute has no retention or deletion policy
for those yet, and that is deliberately deferred.

## Payments and booking history

Providers connect a Stripe recipient account. Checkout uses a destination charge
to transfer the booking payment to that account. Booking terms apply to the
whole provider: Deposit or Full payment, one percentage (10–100% in steps of 5;
a deposit 10–90%; never 0%) and a free-cancellation window of 12, 24 or 48
hours, with an optional written policy. A deposit is that percentage of the
whole booking price (treatment and add-ons), at least £1.00 and never more than
the price; full payment is the whole price. After a late customer cancellation
the provider keeps the same percentage, never more than was paid; an early
cancellation or any provider cancellation refunds everything. The percentage is
rounded to the nearest penny, halves up, once, by PostgreSQL when the hold is
made, and stored on the booking ([decision 006](decisions/006-percentage-booking-terms.md)).
Any balance after a deposit is due at the appointment; collection of that
offline balance is outside Ceaute. There is no pay-later option. Settings saved
before percentages are kept exactly and never converted: they count as
incomplete, so a draft cannot publish and a live page takes no new bookings
until a percentage is chosen, and bookings already made keep their terms,
including £0 kept where an old full-payment setting left the amount blank.

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

Review and pay and the held page show the cancellation deadline, what a late
cancellation keeps, and any written policy; both link to `/terms` and
`/privacy` and give the trader details. There is no separate policy-version record or
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

My bookings lists a hold still waiting for payment first ("Finish booking",
held until a time, with Continue to payment), then Upcoming (soonest first),
Past and Cancelled (newest first). A hold that ended with nothing paid is in no
list and its link says "This held time ended. Nothing was charged."; a payment
that arrived too late is under Cancelled as "Payment refunded" with its
refund's state. "Paid online" counts only a payment that went through.

Only a future confirmed booking can be cancelled. The owning customer and the
owner of the booked provider page have separate authorised paths. The customer
confirms in a dialog that says what happens to the money now ("Cancel and
refund £x" only when something is refunded); the outcome, and a review's, is
shown on the page rather than as an error page. A provider
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

A provider must accept the current provider agreement (version in
`ceaute.current_provider_agreement_version()`) before their page can be
published or take a new booking, and an acceptance is recorded immutably
against its version string. A provider carrying an outstanding liability is
also blocked from new bookings until it is settled; existing confirmed bookings
are unaffected. PostgreSQL checks both when a hold is made and again when
Checkout is claimed; a Stripe Session already open when the gate closes can
still be paid. The customer sees the same neutral "isn't taking online bookings
right now" either way.

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

Transactional confirmation and cancellation email, and the email telling a
customer their late payment is being refunded in full (no address, no timing
promise), is written to a database outbox and delivered by a protected
scheduled route through Resend; the outbox's unique key sends each once. Delivery is
claim-and-retry based. Appointment reminders, SMS, provider replies, distance
search, mobile or virtual appointments, recurring availability exceptions, and
an internal administration UI are not implemented product flows.
