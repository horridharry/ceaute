# 04 · Divergences and gaps

Read this before opening a component. Three categories:

- **A · Designs that need new code** — the design describes something not built yet.
- **B · Code that needs fixing** — the design is right and the code is stale or wrong.
- **C · Matched** — the design already reflects what ships; restyle only.

---

## A · Designs that need new code

### A1 · Treatment modal is centred, not a bottom sheet
`treatment-selection.jsx` renders `TreatmentDetailsSheet` as a bottom sheet
(`items-end`, `rounded-t-2xl`, a drag pill). The design makes it a **centred modal** with
radius 18px and `0 18px 48px rgba(0,0,0,.18)`.

The interaction logic is already correct and should not change: tap row → modal; tap
`Select` → time directly when there are no add-ons, modal when there are; selections
persist per treatment while the page stays open.

*Reason: the user dislikes bottom drawers, and the area picker uses the same centred
treatment. One modal pattern, not two.*

### A2 · Provider dashboard first tab becomes **Today**
`dashboard-overview.jsx` is a link grid: "Overview" plus four navigation cards (Bookings,
My page, Availability, Treatments) and the page URL. It shows no appointments.

The design replaces it with **Today**: the date, today's appointments as rows, then
`NEXT UP`. Needs a loader for today's and upcoming bookings on the dashboard route — the
data exists, the query does not.

### A3 · `Mark done` on a passed booking
New. Once a booking's end time has passed, its row on Today grows `Mark done` /
`Didn't show`. `Mark done` transitions the booking to completed, the same end state the
`complete-bookings` cron already reaches; the button just lets her do it in the moment.

This is the trigger for A4.

### A4 · Photo prompt on completion — the one genuinely new feature
After `Mark done`, prompt: *Add her set to your portfolio?* with a camera/upload tile, a
`Show on my page` toggle, and the treatment + add-ons already attached.

Needs: a nullable `treatment_id` (and optionally `booking_id`) on the portfolio image
record, plus upload from this screen.

Worth the effort because it makes the portfolio grow as a by-product of finishing work
rather than as a separate chore — and it is what would later enable "book this look".
**Not required for launch.**

### A5 · Publishing checklist UI
`publication-readiness.js` computes the ten items. Nothing renders them as a checklist.
The design shows a `6 / 10` counter, a progress rule and per-item action links.

### A6 · Confirming-your-booking interstitial
The Stripe return page reads state; the webhook confirms. Currently there is no screen for
the gap, so a customer can land on an unconfirmed booking and panic.

Add a state to the return route: ring, `Confirming your booking`, `Safe to close this`.

### A7 · Hidden reviews section
The code renders a dashed empty box when a provider has no reviews. The design **omits the
section entirely** — an empty box advertises the absence.

### A8 · Similar providers
A `Similar in <city>` section on the provider page. No ranking exists; discovery has no
recommendation logic. Simplest honest version: same category, same area, excluding the
current provider, ordered by rating then review count. **Cut it for launch if that query
is not trivial.**

### A9 · `[username]/not-found.tsx`
Currently a bad handle falls through to the root `not-found.tsx`, which has no params. A
segment-level not-found would let the page name the handle and suggest providers in the
right area. The commonest 404 is a stale Instagram-bio link, so this is worth more than it
looks.

### A10 · Refund status on the customer's cancelled booking
The cancellation is recorded before the refund, and the refund can be pending or failed.
The design surfaces that with a dot, a status line, and a note that support takes over on
failure. Check whether the booking detail currently reads the refund status at all.

### A11 · Three checkout bounce-back screens
`checkout-payment-notice.js` has the copy; the redirect happens; the designs for
`unavailable`, `expired` and `processing` are new — and `expired` is a different screen
entirely (the time picker), not a notice.

### A12 · The area picker
A modal listing areas with provider counts. Discovery currently filters by a text query
only. Needs a grouped count query. Cut it if areas stay few enough to fit a chip row.

---

## B · Code that needs fixing

### B1 · `/auth/error` copy is from the magic-link era
The file says *"That link did not work"* and *"Request a fresh sign-in email"*. Sign-in is
a **6-digit code** now. Should read *"That sign-in didn't work"* / *"The code may have
expired or already been used."*

### B2 · `error.tsx` links to `/help`, which is being deleted
Remove the third link. Keep `reset()` and `Check my bookings`.

### B3 · Legal footers link `/help`
Same reason. Footer becomes `Privacy` · `Terms`.

### B4 · Provider confirmation email includes a `Where` section
`booking-email-content.js` adds the address panel for both recipients. The provider does
not need her own address. Drop the section for `recipient_role === 'provider'`, and
relabel her payment rows from her side: `Paid to your Stripe`, `Collect on the day`.

### B5 · `provider_cancelled_customer` should offer a way out
It currently renders the same `View booking` action as every other event. This is the one
email where Ceaute has let the customer down: the action should be **Find another time**,
and the copy should state plainly that a provider cancellation never retains money.

### B6 · The whole palette is default Tailwind pink
`pink-600` / `pink-700` / `pink-800` across auth, dashboard nav, storefront and every
button. Replace with `#8c2b52`. Mechanical but touches ~40 call sites.

### B7 · Dashboard nav is an eight-item drawer behind a Menu button
Becomes a five-item visible strip: `Today` · `Bookings` · `Treatments` · `Page` ·
`Settings`, with groups and add-ons as tabs inside Treatments, and locations and
availability inside Page.

### B8 · The root route renders an empty `<main>`
See the redirect table in `03-screens.md`.

---

## C · Matched — restyle only

- Treatment selection interaction (row → modal; Select → time when no add-ons).
- Auth as an emailed 6-digit code verified at `/verify`, with a resend cooldown and a new
  code invalidating the previous one.
- Checkout requiring full name and UK phone before the hold is created; continuing to
  payment is the terms acceptance.
- Exact address released only after a paid, confirmed booking; public area before.
- Add-on ↔ treatment compatibility edited from the add-on side.
- Reviews: one per completed booking, 1–5 plus a comment, first name shown, providers
  cannot delete.
- Payment settings: full or fixed deposit above £0; 12/24/48h cancellation windows; late
  cancellation retains the commitment amount and refunds the rest.
- Booking terms frozen onto a booking at creation.
- Portfolio images stored privately, served through short-lived signed URLs, with optional
  captions and a visibility flag.

---

## Explicitly not in scope

Not designed, not built, not to be invented:

- Reminders of any kind, and SMS. **No reminder toggles anywhere** — an early mock had one
  and it was removed.
- Rescheduling. Changing a booking means cancel + rebook, and the cancel screen says so.
- Provider replies to reviews.
- Distance or map-radius search.
- Recurring availability exceptions.
- Messaging. The `Message` button on the provider's booking detail is a placeholder;
  either wire it to SMS or drop it.
- `Delete account` self-service. The row is in the design; the process does not exist. Keep
  the row, point it at support, and flag it.
- Everything in `Ceaute Reframes.dc.html`: book-the-look, the ritual rebook nudge, customer
  briefs with reference images, search-by-date, the paste-your-menu importer, natural-
  language treatment entry, and the booking-led customer home. Post-launch.

---

## Two decisions the design deliberately defers

**Customer home.** Discover is the launch home for everyone. Once a returning customer has
history, leading with her next booking is better (Reframes 05, no schema change) — but it
needs the volume to be worth it. Revisit after launch.

**The rebook nudge.** Nails and lashes have a natural cadence, so "you're about due" is the
strongest retention lever available. It needs the scheduled-email infrastructure, which the
cron routes already provide. Sequenced after launch, not never.
