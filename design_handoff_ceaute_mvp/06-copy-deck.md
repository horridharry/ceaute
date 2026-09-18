# 06 · Copy deck

Every user-facing string in the designs, so copy is not retyped from a screenshot. Where a
string contains data, the placeholder is in braces.

## Voice

Plain, second person, present tense. State what happened and what it costs. No exclamation
marks, no emoji, no "oops", no apology longer than the fix. Never name an internal
mechanic the user has not been told about — the button says `Continue`, not "Hold the slot".

Amounts always as figures (`£10.00 retained`), never percentages. Durations as she would
say them (`2h 30m`, `1h 45m`).

---

## Discover

| Element | Copy |
| --- | --- |
| Masthead label | `{WEEKDAY} · {CITY}` |
| Masthead headline | `Nails, lashes, hair, brows.` |
| Count line | `{n} independent techs booking in {city}.` |
| Search placeholder | `Treatment or place — or neither` |
| Title with query | `{Category} in {City}` |
| Result count | `{n} providers` |
| New-page badge | `JOINED THIS WEEK` |
| No reviews yet | `New · no reviews yet` |
| Empty results heading | `Nothing matches that yet` |
| Empty results line | `Try a wider area, or browse by category.` |

### Area picker
| Element | Copy |
| --- | --- |
| Title | `Where?` |
| Search placeholder | `Town or area` |
| First row | `Anywhere` · `{n} lash techs` |
| Sections | `NEAR YOU` / `FURTHER` |

Only the first row spells out the unit; the rest are bare counts.

---

## Provider page

| Element | Copy |
| --- | --- |
| Meta | `@{handle} · {Category} · {City} · {rating} ({count})` |
| Portfolio heading | `Portfolio` |
| Portfolio sub-line | `Recent sets by {Name}` |
| See-all links | `See all {n}` |
| Reviews sub-line | `{rating} average · verified bookings only` |
| Policies — deposit | `£{n} deposit` / `Balance paid on the day. Deposit comes off the total.` |
| Policies — cancellation | `Free cancellation up to {n} hours before` / `After that £{n} is retained and the rest refunded.` |
| Policies — location | `Home studio, {City}` / `Full address is shared once your booking is confirmed.` |
| Similar heading | `Similar in {City}` |
| Similar sub-line | `{Category} with comparable work and prices` |
| Commit bar | `from £{n}` / `Next free: {when}` / `Book` |

Treatments page: `Treatments` · `{n} across {m} groups`

---

## Booking

### Treatment modal
| Element | Copy |
| --- | --- |
| Sub-line | `{duration} · £{price}` |
| Add-ons label | `ADD-ONS · OPTIONAL` |
| Add-on delta | `+ £{n}` or `+ £{n} · + {m} min` |
| More add-ons | `Show {n} more` |
| Commit | `£{total} · {duration}` / `{Treatment} + {n} add-ons` / `Pick a time` |

### Pick a time
| Element | Copy |
| --- | --- |
| Title | `Pick a time` |
| Sub-line | `{duration}` |
| Day heading | `{Weekday} {date}` |
| Commit | `{Day} {date}, {time}` / `until {end}` / `Continue` |

### Sign in
| Element | Copy |
| --- | --- |
| Held row | `{Day} {date}, {time} is yours for` · `{m:ss} min` |
| Title | `Enter your code` |
| Body | `A 6-digit code was sent to {email}. Your time stays held.` |
| Field label | `Verification code` |
| Primary | `Continue` |
| Resend | `Nothing arrived?` · `New code in {n}s` / `Send a new code` |
| Change email | `Different email` |
| Footnote | `A new code replaces the old one.` |

Standalone `/sign-in`: `Log in` / `Continue to your Ceaute account` / `Continue with
email` / `A code is emailed to you. No password.` / `New to Ceaute? Get started`

Standalone `/sign-up`: `Create your account` / `One account to book, and to run a page if
you want to.` / `By continuing you agree to the Terms and Privacy policy.`

### Review & pay
| Element | Copy |
| --- | --- |
| Title | `Review & pay` |
| Fields | `Full name` · `UK mobile` |
| Phone helper | `Shared with {Provider} for this appointment only.` |
| Summary last line | `Pay today (deposit)` |
| Terms line | `£{n} due on the day. Free cancellation until {Day} {date}, {time}.` |
| Primary | `Continue to payment · £{n}` |
| Beneath | `Card details are taken by Stripe. You'll land back here.` |

### Confirming
`Confirming your booking` / `Stripe took your payment. We're waiting for it to confirm the
time with {Provider} — usually a few seconds.` / `Safe to close this — the confirmation and
receipt arrive by email either way.` / `Go to my bookings`

### Confirmed
| Element | Copy |
| --- | --- |
| Eyebrow | `CONFIRMED · {ref}` |
| Headline | `{Name}, you're booked with {Provider} for {Weekday} at {time}.` |
| Body | `{Treatment} with {add-ons}. £{paid} paid; £{due} on the day. The address is below and on the booking.` |
| Panel | `{Day} {date} · {start} – {end}` · `{duration}` · address · access note |
| Actions | `Add to calendar` · `Directions` |
| Footer | `Receipt sent to {email}` |

---

## Customer account

| Element | Copy |
| --- | --- |
| Title | `Bookings` |
| Tabs | `Upcoming` · `Past` |
| Amounts | `£{n} due` / `Paid in full` / `Not paid` |
| Review group | `AWAITING YOUR REVIEW` · `Review` |
| Empty | `No bookings yet` / `When you book someone, it shows here with the address and what's due.` / `Find someone →` |

### Booking detail — confirmed
`Where` · access note · `Directions` · `Add to calendar` · `Due at appointment` ·
`Cancellation window {n} hours. Before {Day} {date} {time}, cancelling refunds £{n}. At or
after, Ceaute refunds £{n} and retains £{n}.` · `Cancel booking`

### Cancel
| Element | Copy |
| --- | --- |
| Title | `Cancel this booking` |
| Sub-line | `{Treatment} with {Provider}, {Day} {date} at {time}.` |
| Panel label | `CANCELLING NOW` |
| Rows | `Refunded to your card` · `Retained by {Provider}` |
| Explanation | `You're inside the {n}-hour window, so the full £{n} comes back. Refunds usually take 5–10 working days to show. From {Day} {date} {time} the outcome flips: £{n} refunded, £{n} retained.` |
| Rebook prompt | `Rather move it?` / `Cancel, then rebook — the deposit refund covers it` |
| Acknowledgement | `I understand this cancellation and refund outcome.` |
| Buttons | `Cancel booking` · `Keep booking` |

### Cancelled
`Cancelled by you · {date}, {time}` · `Refund` · `Refunded` · `Retained` ·
`Refund processing with Stripe` / `Sent {date}. Usually 5–10 working days to reach your
card. We'll email when it lands.` · `If the automatic refund fails` / `This card shows
"needs review" and support takes over. You don't need to chase it.` ·
`{City} · exact address no longer shown` · `Book {Provider} again`

### Review
`How was it?` / `One review per booking. Shown as "{FirstName}" on her page.` /
`{n} / 1000` / `Submit review`

### Settings
`Account` / `Signed in as {email}` · `PERSONAL DETAILS` · `Full name` · `Phone number` /
`UK mobile · used by providers to reach you about a booking` · `Email` / `Sign-in identity`
· `Take bookings yourself` / `Same account — set up a provider page` / `Start` ·
`Sign out` · `Delete account` / `Permanently delete your Ceaute account`

---

## Provider

### Today
`Today` / `{Weekday} {date}` · `until {end} · £{n} to collect` / `until {end} · paid in
full` · `NEXT UP` · `{time} · being paid for now` · `Awaiting payment` ·
`Mark done` · `Didn't show`
Empty: `Nothing booked today` / `Your page is live. Share it and the diary fills up.` /
`Share your page`

### Photo prompt
`{Name} · {start} – {end} · DONE` · `Add her set to your portfolio?` / `It's tagged
already — {Treatment} + {add-ons}, £{total} — so the next person can book exactly this.` ·
`Take a photo` / `or choose from camera roll` · `Show on my page` · `Ask {Name} for a
review` / `Sent when marked done` · `Mark done · collected £{n}`

### Publishing checklist
`Ready to publish?` · `{n} / 10` · `Publishing is checked by the database, not this list —
if something is missing it will tell you exactly what.` · `Publish page`
Items: `Business name, username, category, bio` · `Location with public area and private
address` · `At least one working day` · `One active treatment with category, price,
duration` · `Booking terms: payment and cancellation` · `One visible portfolio photo` ·
`Stripe payments ready`

### Published (letter)
`{Name}, Cluxeklaws is live.` / `Anyone with the link can book from your {n} treatments, 24
hours out and up to 60 days ahead. Deposits go to your Stripe.` · `ceaute.com/@{handle}` /
`Paste it where your Linktree was.` · `Share link` · `See it as a customer` ·
`Published {date}, {time} · unpublish any time from Settings`

### Page
`Your page` · `Preview` · `Edit identity` · `Portfolio` / `{n} photos · drag to reorder` /
`First photo is the hero. Tap a photo to caption or hide it.` · `HERO` · `Hidden` ·
`Location` / `{City} · address private` · `Working hours` / `{Days} · {n} blocked dates`

### Location
`Location` · `PUBLIC — SHOWN IN DISCOVER AND ON YOUR PAGE` · `Area` / `Keep it broad — a
neighbourhood or town, not a street.` · `PRIVATE — ONLY AFTER A PAID, CONFIRMED BOOKING` ·
`Address line 1` · `Address line 2 — optional` · `City` · `Postcode` ·
`Access instructions — optional` · `Save location`

### Availability
`Working hours` / `One block per day, on the quarter hour. Customers book with 24 hours'
notice, up to 60 days ahead.` · `Closed` · `BLOCKED DATES` · `+ Block a date` ·
`Save hours`

### Treatments
`Treatments {n}` · `Groups {n}` · `Add-ons {n}` · `+ New` · `≡ reorder` · `Active` ·
`Archived` · `NO GROUP · {n}`
Groups tab: `Groups are how your page is organised. They're yours — customers find you by
category, not by these.`

### Treatment form
`New treatment` · `Name` · `Price` · `Duration` · `Discovery category` / `Shown in
Discover.` · `Group — yours, optional` · `+ New group` · `Description — optional` /
`Shown in full on the treatment screen — explain what's included.` · `Create treatment`

### Add-on form
`New add-on` · `Name` · `Adds to price` · `Adds to time` / `Must add to price, time or
both.` · `Works with` · `Select all in {Group}` / `Customers only see this add-on on the
treatments you tick.` · `Create add-on · {n} treatments`

### Booking detail
`Call {phone}` · `Message` / `Contact details are the ones she gave at booking.` ·
`Paid online → your Stripe` · `Collect on the day` · `Booked under: £{n} deposit, {m}-hour
window. These terms are frozen for this booking even if you change your settings.` ·
`Cancel as provider` / `Refunds her full £{n} regardless of timing, and frees the slot
immediately. She's emailed.` · `Cancel booking · refund £{n}`

### Booking terms
`Booking terms` · `Customers pay` · `A fixed deposit` / `Rest on the day` · `In full` /
`Nothing on the day` · `Deposit` / `Must be more than £0 — there's no pay-later.` ·
`Free cancellation up to` · `Customers pay £{n} when booking. If they cancel with less
than {m} hours' notice, that £{n} is retained. Earlier than that, it's refunded in full.` ·
`Written policy — optional, shown at checkout` · `Save terms` /
`Existing bookings keep the terms they were made under.`

### Payments
`Payments` / `Customer payments go straight to your Stripe account. Ceaute's fee is
currently £0.` · `Setup incomplete` / `Stripe still needs a few things before you can be
paid. Your page can't publish until this is ready.` · `REQUIRED BY STRIPE` ·
`Transfers` · `Payouts` · `Recipient setup` · States: `Not connected` · `Setup incomplete`
· `Stripe is reviewing` · `Payments ready` · `Restricted` · `Refresh status` ·
`Resume onboarding`

### Onboarding
`Create your page` / `This makes a draft. Nothing is public until you publish.` ·
`Business name` · `Username` / `This is the link for your Instagram bio.` · `Available` ·
`Category` / `How customers find you in Discover. You group your own treatments however
you like later.` · `Biography` · `Create draft page` / `Then: location, hours, a treatment,
terms, a photo, Stripe.`

---

## Email

Subjects come from `EVENT_TITLES` in `booking-email-content.js` — unchanged.

| Event | Headline | Opening line |
| --- | --- | --- |
| Confirmed, customer | `{Name}, you're booked with {Provider}.` | — |
| Confirmed, provider | `{Name} booked {Treatment} for {Weekday} at {time}.` | — |
| Cancelled by customer, to customer | `Your £{n} is on its way back to your card.` | `{Day} {date} at {time} with {Provider} is cancelled, and the time is free for someone else.` |
| Cancelled by provider, to customer | `{Provider} cancelled your {Weekday} appointment.` | `{Treatment} on {date} at {time} is off, and your full £{n} is being refunded — a provider cancellation never keeps anything.` |
| Cancelled by customer, to provider | `{Name} cancelled {Weekday}. You keep the £{n}.` | `She cancelled after the deadline, so the deposit stays with you and nothing is refunded. {Weekday} {start} to {end} is open on your page again.` |
| Cancelled by provider, to provider | `You cancelled {Weekday} with {Name}.` | — |

Shared strings:
- `£{paid} paid. £{due} due on the day.` / `Free cancellation until {Day} {date}, {time}.`
- Provider variant: `£{paid} is in your Stripe. Collect £{due} on the day.` / `She can
  cancel free until {Day} {date}, {time}.`
- Refund statuses: `Refund processing with Stripe` / `Usually 5 to 10 working days to reach
  the card you paid with.` · `The first refund attempt failed. Ceaute is retrying it.` /
  `Nothing is needed from you. The retry runs automatically and support is alerted if it
  fails again.` · `Settled — no refund due`
- Footer: `You are receiving this email because of a booking made through Ceaute.` /
  `Sent by Ceaute`

**Sign-in code email:** `Your code is` · `{code}` · `Type it into the tab you were on.
Asking for another code replaces this one.` / `If you did not ask to sign in, ignore this —
nothing happens without the code.`

---

## Failures

### `payment=unavailable`
`Payment is not available` / `{Provider} cannot take card payments right now. Your time is
still held while you decide.` · `This is between Ceaute and {Provider} — nothing to fix on
your side. Most cases clear within a day.` · `Try again` · `Find another provider`

### `payment=expired`
`That payment session expired.` / `Nothing was charged, and {time} on {Weekday} has been
released. It may still be free — {Provider}'s times are below.` · `Your treatment and
add-ons are kept. Picking a time holds it again for five minutes.` · `See other days`

### `payment=processing`
`A payment is already going through.` / `An earlier attempt for this booking is still
finishing. Give it a few seconds rather than paying again — a second payment would be a
second charge.` · `Waiting on Stripe` / `Your slot stays held until {time} while this
resolves.` · `If it went through, the booking appears in Bookings and the confirmation
arrives by email. If it did not, this page lets you pay again.` · `Check again` ·
`Go to my bookings`

### `/auth/error`
`That sign-in didn't work.` / `The code may have expired or already been used. Your account
has not been changed.` · `Return to sign in` · `Anything you were booking is still there if
the hold has not run out.`

### `not-found`
`That page isn't here.` / `The link may be out of date, or the provider page may not be
published yet. Nothing was lost if you had a booking — it is still in Bookings.` ·
`Booking now on Ceaute` · `Discover providers`

### `error`
`SOMETHING WENT WRONG` · `That did not work.` / `Ceaute could not finish what you asked.
Trying again usually works.` · `If you were paying, no charge was taken unless you saw a
confirmation. Check Bookings before trying again.` · `Try again` · `Check my bookings` ·
`Reference: {digest}`

---

## Legal

Headings and body verbatim from `terms/page.tsx` and `privacy/page.tsx`. Two framework
strings:

- Draft notice: `Draft for owner review` / `This page describes how Ceaute actually
  operates today. It has not yet been approved as final by Ceaute's owner or reviewed by a
  lawyer. Anything marked "Owner TODO" below is an open question, not a term you can rely
  on.`
- Callout prefix: `Owner TODO — `

Footer: `Privacy` · `Terms`. Page footer link: `Back to Ceaute`.
