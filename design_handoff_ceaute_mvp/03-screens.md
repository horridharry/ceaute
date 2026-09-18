# 03 · Screens

Every route, the template it uses, and what it contains. The five templates come first —
each screen is one of them, so build the templates as layout components and the screens
become assembly.

Sources: `Ceaute MVP Spec.dc.html` §3–4, `Ceaute System Screens.dc.html`,
`Ceaute Provider Page.dc.html`, `Ceaute Desktop.dc.html`.

---

## The five templates

### T1 · List
Title → optional search / tabs / chips → a stack of one card or row kind, 8px apart, with
group labels between. No commit bar.

**Routes:** Discover, customer Bookings, provider Today and Bookings, `/@user/treatments`,
dashboard Treatments, Add-ons, Reviews.

### T2 · Detail
Stacked nav → title + meta → body → sections separated by 24px and a `hairline`, each with
a `heading` and an optional `See all` link → commit bar. An optional hero image sits above
the title (provider page only).

**Routes:** provider page, treatment detail, booking detail (both sides).

### T3 · Form
Modal nav → fields in one column 13px apart → optional notice → commit bar with the single
primary. Pairs side by side only for price + duration and city + postcode.

**Routes:** every create/edit screen, Review & pay, sign in, sign up, onboarding, booking
terms, location.

### T4 · Picker
Stacked nav → held row (once a hold exists) → title → month header with prev/next →
five-day strip → day name → slot grid → commit bar showing the chosen time.

**Routes:** pick a time; provider availability (rows instead of a grid).

### T5 · Letter
Wordmark-only nav, **nothing in the top right** → eyebrow label → second-person headline at
30px/1.12 → one paragraph → one framed panel (photo + details, or a link card) → button
pair → a quiet text button that leaves the page.

**Routes:** Confirmed, Published, Cancelled. **Nowhere else** — the voice only works
because it is rare.

Every exit on a letter screen is in the bottom third, for one-handed reach.

---

## Customer routes

### `/` — root
Currently renders an empty `<main>`. Replace with a **server-side, temporary** redirect
(not permanent — a marketing page will eventually want this URL, and a 308 caches in
browsers for a long time):

| Visitor | Destination |
| --- | --- |
| Signed out | `/discover` |
| Signed in, customer | `/discover` |
| Signed in, has a provider page | `/dashboard` |
| Mid-booking with a live hold | back to the held booking |

Also: the wordmark in the top bar should link to `/discover` for customers and
`/dashboard` for providers — not to `/`. The redirect is then a fallback for typed URLs
rather than something users hit constantly.

### `/discover` — T1
Title → search input → chips → results.

**No search yet:** the city as a masthead. `WEDNESDAY · MANCHESTER` label, a 40px headline
(`Nails, lashes, hair, brows.`), a count sentence, the search box, category chips with
counts, then a `NEWEST PAGE` provider card.

**With a query:** title becomes `Lashes in Manchester`, the query shows in the search box
with a clear `×`, area chips beneath, a `3 providers` count, then provider cards.

**Area picker** (when there are more areas than fit a chip row) is a centred modal, not a
bottom drawer — the user dislikes bottom drawers, and this is now consistent across the
product. A search field inside, then rows of area + count. The first row spells the unit
out (`12 lash techs`) so the bare numbers beneath are unambiguous. Sections: `NEAR YOU`
then `FURTHER`. No footnote.

Empty results: the empty-state component, plus the chips so the user can widen.

### `/@username` — T2 with hero
**This is design 8b and it is locked.** Full detail in `Ceaute Provider Page.dc.html`.

Order, top to bottom:
1. **Hero** — 216px, swipeable, a plain `1 / 9` counter bottom right. No dot strip, no
   arrows, no invented affordance. Back and save buttons as 32px translucent circles.
2. **Identity** — name at `title`, `@handle · Category · City · 5.0 (34)`, avatar 48px on
   the right.
3. **Bio** — verbatim from the provider, line breaks preserved.
4. **Portfolio** — `heading` + `See all N`, sub-line `Recent sets by <name>`, then a
   horizontal strip of 118 × 140px images.
   The heading is **`Portfolio`**, not "Her work" — the possessive moves into the
   sub-line, which keeps the personal feel without gendering the template.
5. **Treatments** — `heading` + `See all N`, then three treatment rows.
6. **Reviews** — `heading` + `All N`, average + `verified bookings only`, then cards.
   **Hidden entirely when there are none** (the code currently shows a dashed empty box).
7. **Policies** — deposit, cancellation window, location privacy, as setting rows.
8. **Similar in <city>** — smaller provider rows.
9. **Commit bar** — `from £31` over `Next free: tomorrow 11:45`, and `Book`.

Chips filter **treatments only**. The portfolio is never coupled to them.

### `/@username/treatments` — T1
Title + `21 across 8 groups`, chips for the groups, then rows under sticky group labels.

This page exists because 21 treatments across 8 groups is too long a scroll to sit between
the portfolio and the reviews, and because a provider can link a single group straight to
her Instagram story.

### Treatment detail — a modal, not a page
**Interaction (already implemented in `treatment-selection.jsx`, keep it):**
- Tapping a treatment row always opens the details modal.
- Tapping `Select` goes **straight to the time picker** when the treatment has no add-ons,
  and opens the same modal when it does.

The modal is centred over a `rgba(11,11,11,.32)` scrim — the code currently renders it as
a bottom sheet; make it centred, for consistency with the area picker.

Contents: name, `1h 30m · £25`, then the **full description** (this is where a provider's
long explainer finally has room — Byuwauk's infill timing note, Cluxeklaws' "what is
acrygel"), then `ADD-ONS · OPTIONAL`, then the add-on rows, then a commit bar carrying the
live total and `Pick a time`.

The total updates as add-ons are checked — price and duration both.

### Pick a time — T4
Title `Pick a time`, sub-line with the total duration only.
Month header with prev/next. Five-day strip. Day name. Slot grid, three per row.
Commit bar: chosen time over `until 13:20`, and a plain **`Continue`**.

The CTA is `Continue`, not "Hold Wed 23, 11:45" — a label naming a mechanic the customer
has not been told about yet reads as jargon.

No captions explaining why certain starts are missing. Reviewers learn to ignore grey hint
text, and the absence is self-evident.

### Sign in — T3
Reached after the time is held. **An emailed 6-digit code, verified at `/verify`.** Not a
magic link, not a password.

`Enter your code` → `A 6-digit code was sent to harriso@example.com. Your time stays
held.` → six-cell code input → disabled `Continue` → `Nothing arrived? New code in 42s`
and `Different email` → footnote `A new code replaces the old one.`

The resend cooldown and the "newer code invalidates the old one" behaviour are already in
`(authenticate)/actions.js`; the design just surfaces them.

### Review & pay — T3
Held row sticky at the top with the countdown.
`Review & pay` → **Full name** and **UK mobile** (both required before the hold is
created) → summary card with line items and `Pay today (deposit)` → one sentence:
`£19.00 due on the day. Free cancellation until Tue 22 Sep, 11:45.` → commit bar
`Continue to payment · £10` with a `400 · 11.5px` line beneath: `Card details are taken by
Stripe. You'll land back here.`

Phone helper: `Shared with Eluxe for this appointment only.` — passive, one line.

Do not restate the terms at length. The earlier three-sentence version was cut; people do
not read it and it makes the screen feel legal.

### Confirming your booking — interstitial
Stripe's return page only reads state; the **webhook** confirms. So the return lands here:
a 36px `plum` ring, `Confirming your booking`, one sentence explaining the wait, a small
summary card, and `Safe to close this — the confirmation and receipt arrive by email
either way.` Plus a tertiary `Go to my bookings`.

### Confirmed — T5
The screen the whole design is built around.

`CONFIRMED · CX-4482` eyebrow → `Harriso, you're booked with Eluxe for Wednesday at
11:45.` → one paragraph with treatment, amounts and where the address is → framed panel
with a 150px photo, the date/time line, the address and access note → `Add to calendar`
and `Directions` → `Receipt sent to harriso@example.com`.

### `/account/bookings` — T1
Tabs `Upcoming` / `Past`. Booking cards. A `AWAITING YOUR REVIEW` group beneath for
completed bookings with no review, each with a `Review` pill.

### `/account/bookings/[id]` — T2
**Confirmed:** title, date line, status, provider row with `View page`, `Where` with the
full address and access instructions, `Directions` / `Add to calendar`, the summary card,
then the cancellation sentence stating the actual amounts. Destructive `Cancel booking`.

**Cancel confirmation:** states the outcome as two figures —
`Refunded to your card £10.00` / `Retained by Cluxeklaws £0.00` — then what changes after
the deadline, an acknowledgement checkbox, a red-filled `Cancel booking`, and a quiet
`Keep booking`.
Rescheduling does not exist, so the screen offers cancel-then-rebook honestly.

**Cancelled:** refund status with its dot, amounts, and the failure path spelled out
(support takes over; nothing for the customer to chase). The exact address is **redacted**
— `Manchester · exact address no longer shown`.

**Completed:** `How was it?` with a 1–5 row of cells, a comment box with a character
count, `Submit review`, and a note that it shows as their first name.

### `/account/settings` — T3
Personal details (name, phone with a UK-mobile helper, email marked as the sign-in
identity), a `Take bookings yourself` row for customers without a page — or a
plum-filled provider card linking to the dashboard for those who have one — then
`Sign out` and `Delete account`.

---

## Provider routes

### `/dashboard` — T1, nav strip, first tab is **Today**
Not "Overview". She opens her phone to see today's work.

Date only as the sub-line — no counts, no money summary in the header.
Then today's appointments as bordered rows: time in `plum` if current, client and
treatment, `until 12:30 · £20 to collect`, status.
Then `NEXT UP` with dated rows, including any held slot as `11:45 · being paid for now`
with an `Awaiting payment` status.

**When a booking's end time has passed**, its row grows a `Mark done` / `Didn't show`
button pair in place. `Mark done` opens the photo prompt (see divergences — this is new).
Unmarked by midnight, the existing cron completes it automatically.

**Empty:** `Nothing booked today`, the date, one line, and a `Share your page` action.
No stats grid on an empty day.

### `/dashboard` — draft state
Before publishing, Today is replaced by the **publishing checklist**, mirroring
`publication-readiness.js` item for item: display name, username, category, bio, active
location, working hours, at least one active categorised treatment, booking terms, at
least one visible portfolio image, a Stripe recipient account.

A `6 / 10` counter, a 4px progress rule, complete items on `surface` with a green check,
incomplete ones bordered with their action link. `Publish page` disabled until all pass.
One line: publishing is checked by the database, not this list.

### `/dashboard/profile` — Page tab
Identity card with `Edit identity`, then the portfolio as a 3-up grid with a `HERO` badge
on the first image, a `Hidden` overlay on hidden ones, and a dashed `+` tile. One line:
first photo is the hero, tap to caption or hide. Then setting rows for Location and
Working hours.

### `/dashboard/locations` — T3
Two labelled halves. **`PUBLIC — SHOWN IN DISCOVER AND ON YOUR PAGE`** with a green dot,
containing Area, helper `Keep it broad — a neighbourhood or town, not a street.`
Then **`PRIVATE — ONLY AFTER A PAID, CONFIRMED BOOKING`** with a plum dot, containing
address lines, city + postcode, and access instructions.

The visual split is the whole point — this is the screen where a woman decides whether to
trust the product with her home address.

### `/dashboard/availability` — T4 variant
One row per weekday: day, current period, toggle. The row being edited expands to two time
selects with `:00 :15 :30 :45` shown as a hint. Closed days read `Closed` at `text-4`.
Then `BLOCKED DATES` as removable chips plus `+ Block a date`.

One line at the top covering the fixed rules: one block per day, on the quarter hour,
24 hours' notice, 60 days ahead.

### `/dashboard/treatments` — T1, tabs inside
Tabs: `Treatments 21` / `Groups 8` / `Add-ons 24`. `+ New` in the header.
Treatments grouped under labels with a `≡ reorder` affordance, each row showing
`£71 · 4h · Nails · 6 add-ons` and an Active/Archived status.

Groups tab: rows with a drag handle, name, count, `Edit`. One line: groups organise your
page; customers find you by category.

### Treatment form — T3
Name → price + duration pair → category select (helper: `Shown in Discover.`) → group as
chips including `+ New group` → description.

**No explanatory block about add-ons.** An earlier version carried a notice saying add-ons
are attached from the add-on side; it was cut. If the relationship needs explaining, it
belongs on the Add-ons tab where it is visible.

### Add-on form — T3
Name → `Adds to price` + `Adds to time` pair → helper `Must add to price, time or both.`
→ `Works with` as a grouped, checkable list of treatments with a `Select all in Toes`
shortcut. Commit: `Create add-on · 3 treatments`.

Compatibility is edited from the add-on side, matching the schema.

### `/dashboard/bookings` and `[id]` — T1, T2
Diary grouped by date; tabs `Upcoming` / `Past` / `Cancelled`.
Detail: client name as the title, treatment and times, status, `Call` and `Message`
buttons, a summary card ending in `Collect on the day`, a line stating the terms are
frozen for this booking, and a destructive `Cancel booking · refund £10` — a provider
cancellation always refunds in full regardless of timing.

### `/dashboard/settings/booking` — T3
Payment mode as two option cards (fixed deposit / in full) → deposit amount (helper:
`Must be more than £0 — there's no pay-later.`) → cancellation window as three chips
(12h / 24h / 48h) → a `surface` block restating the result as a sentence with the real
figures → the provider's own written policy as a textarea.
Footnote: `Existing bookings keep the terms they were made under.`

### `/dashboard/settings/payments` — T1
The current state as a bordered card with its dot, what Stripe still needs, and the three
capability lines. Then the five states listed with dots so she can see where she is:
not connected, setup incomplete, reviewing, ready, restricted.
Commit: `Refresh status` + `Resume onboarding`.
One line: payments go straight to her Stripe; Ceaute's fee is currently £0.

### `/dashboard/onboarding` — T3
Business name → username with a live `ceaute.com/@` prefix and an `Available` check →
category chips → biography. Commit `Create draft page`, with a line listing what comes
next. Nothing is public until publish.

---

## Email — 6 booking events + the sign-in code

600px. Tables and inline styles. **Ships with the system font stack** already in
`email-layout.js`.

These are **letters, not receipts**. The previous version was a coloured bar, a pill badge,
a caps label over every block and thirteen label/value rows — which ranks every fact
equally, so the two things that get acted on (the time and the address) were buried.

Shape:
1. Small `ceaute` wordmark above the card.
2. White card, 1px border, radius 14px, 36px padding. No coloured top bar beyond a 4px
   rule: `plum` for confirmations, `ink` for cancellations.
3. A second-person headline at `600 · 30px / 1.14`.
4. For confirmations: the date and time as a block — day at `500 · 15px` `text-3` over the
   time at **`600 · 46px`** tabular, with `until 16:30 · 2h 30m` alongside.
5. Facts as short sentences, separated by `hairline` rules.
6. The address as prose, not a table row.
7. Actions as two buttons.
8. Money as one bolded line plus the cancellation deadline beneath.

| Event | Headline | Primary action |
| --- | --- | --- |
| `booking_confirmed_customer` | `Harriso, you're booked with Byuwauk.` | **Directions** (more useful on the day than View booking, and a maps link needs no session) |
| `booking_confirmed_provider` | `Harriso booked Volume Full Set for Friday at 14:00.` | Open booking |
| `customer_cancelled_customer` | `Your £10.00 is on its way back to your card.` | Book again (tertiary) |
| `provider_cancelled_customer` | `Eluxe UK cancelled your Wednesday appointment.` | **Find another time** |
| `customer_cancelled_provider` | `Aisha cancelled Thursday. You keep the £10.00.` | Your diary (tertiary) |
| `provider_cancelled_provider` | `You cancelled Thursday with Aisha.` | Your diary (tertiary) |

Rules preserved from `booking-email-content.js`: cancellation emails **never** include the
private address; only provider emails carry the customer's email and phone; refund status
uses its dot colour; every fact in the HTML is also in the text alternative.

**Sign-in code email** is sent by Supabase, not this layout — the template is editable.
`Your code is` then the six digits at `600 · 54px`, `+0.14em`, tabular. No button. No
expiry claimed in copy, since the window is a Supabase setting.

---

## Failure screens

### Checkout bounce-backs
`startStripeCheckoutForBooking` redirects back with
`payment=unavailable | expired | processing`. Copy lives in `checkout-payment-notice.js`.

- **`unavailable`** — hold is alive. Stay on Review & pay; a problem row beneath the held
  row: `Payment is not available` / `Eluxe UK cannot take card payments right now. Your
  time is still held while you decide.` Primary `Try again`, quiet `Find another provider`.
  Do not name the provider's Stripe state — the customer cannot act on it, and the same
  redirect also covers an unpublished page.
- **`expired`** — hold is gone, so nothing on the checkout screen is true any more.
  Becomes the **time picker** with `That payment session expired.` as the headline, the
  basket preserved in a card, and the slots for that day offered again (the slot was
  released, not taken).
- **`processing`** — the dangerous one, because a second payment is a second charge.
  **Remove Pay entirely.** `A payment is already going through.`, a `pending` row
  (`Waiting on Stripe` / `Your slot stays held until 10:14`), then `Check again` as the
  primary and `Go to my bookings` beneath.

### `/auth/error`
A static card with **one** link to `/sign-in`. No form, no resend — the route has no state,
and the pending-auth cookie is deleted on success.
`That sign-in didn't work.` / `The code may have expired or already been used. Your account
has not been changed.` / `Return to sign in`.

**Fix the copy in code:** the file still says "That link did not work" and "Request a fresh
sign-in email" from the magic-link era.

### `not-found.tsx`
The root boundary catches a bad `@username`, because `[username]/page.jsx` calls
`notFound()` and that segment has no not-found file. So it **cannot** echo the handle or
localise suggestions.
`That page isn't here.` / `The link may be out of date, or the provider page may not be
published yet. Nothing was lost if you had a booking — it is still in Bookings.` Then a
generic `Booking now on Ceaute` provider card and `Discover providers`.

Adding `[username]/not-found.tsx` would let it name the handle and suggest techs in the
right area — worth doing, since the commonest 404 is a stale Instagram-bio link.

### `error.tsx`
Everything needed is already in the file: `reset()`, a heading and message from
`describeRouteError`, and a conditional digest.
Eyebrow `SOMETHING WENT WRONG` (standing in for the dynamic heading) → `That did not work.`
→ the message → **a new hairline-bounded sentence: `If you were paying, no charge was
taken unless you saw a confirmation. Check Bookings before trying again.`** → `Try again`
(calls `reset()`) → `Check my bookings` → `Reference: 8f3a1c` small at the bottom.

Remove the third link, `Get help` — `/help` is being deleted.

---

## Legal — `/terms`, `/privacy`

One column, `max-width: 720px` on desktop, centred; the app shell at 390px.
Every heading verbatim from `terms/page.tsx` and `privacy/page.tsx`.

**Keep the draft mechanism.** The `draft` notice and every `<Todo>` callout stay visible —
they are a deliberate quality gate, and hiding them would present unreviewed terms as
final. These are the only place in the product where amber and a dashed border appear.

Body steps up to `400 · 14.5px / 1.65` in a 600px measure. Each Owner TODO sits directly
beneath the section it qualifies, never collected at the bottom. Bullets render as dotted
rows, not browser list markers.

Footer links are `Privacy` and `Terms` only — `/help` is being deleted.

---

## Desktop

Content column `max-width: 720px`, centred. The mobile layouts hold; three things change:

1. The provider nav strip becomes a left column.
2. The treatment modal and area picker become centred popovers with the same shadow.
3. The provider page puts the portfolio in a 2-up grid rather than a horizontal strip.

Anything not a fixed-format artefact must reflow: `max-width` rather than `width`, grid
tracks that wrap or use `minmax(0, 1fr)`, no `nowrap` on anything holding text.

Details in `Ceaute Desktop.dc.html`.
