repo: horridharry/ceaute
branch: main

## Last sync

date: 2026-09-18T12:10:00Z
commit_tree: d4f08eb91739

### Updated in this project

- Auth changed upstream to an emailed 6-digit code on `/verify` (email held in an httpOnly cookie; 6 digits; resend cooldown; "a new code replaces the old one"). Rebuilt the sign-in frames in Customer Account Flow, Ceaute App, Customer Booking Flow and the Booking Prototype; the earlier magic-link correction is reversed.
- Storefront now ships `treatment-selection.jsx`: tap row → details sheet; Select → time directly when no add-ons, sheet when there are. Matches the MVP Spec; no change needed.
- Built `Ceaute System Screens.dc.html` (replaces the Email and Legal sheet): booking emails redesigned as letters rather than label/value receipts — same facts and order from booking-email-content.js, reweighted so time and address lead; plus the Supabase sign-in code email, the three checkout bounce-backs (payment=unavailable | expired | processing), /auth/error, not-found, error, /terms, /privacy and the root-route decision.
- /help is being deleted, so legal footers link Privacy and Terms only.
- New upstream: cron routes (complete-bookings, recover-booking-refunds, send-booking-emails), `checkout-payment-notice.js` (unavailable / expired / processing copy), sign-up collects full name.

### Previously (16 Sep)

- Read auth (magic link), dashboard nav/overview, publication readiness, customer booking detail, payments settings; user supplied product/domain/architecture docs.
- Built Customer Account Flow and Provider Dashboard Flow; corrected sign-in to emailed link; added verifying-payment state.
- Re-read product.md, storefront view model, availability calculator, booking pages (add-ons, time, checkout), discover, booking settings, treatment and add-on forms.
- Customer Booking Flow: Review & pay now collects full name + UK phone; failed-payment state shows hold expiry (Checkout extends the hold to ~31 min); late-cancellation copy uses a fixed retained amount, never a percentage; reviewers by first name with rating /5.
- Recorded two intentional divergences from live code (treatment detail screen; hidden empty reviews) and one provider-side note (add-on compatibility is set from the add-on, not the treatment).

## Sync history

### 2026-09-16T01:12:00Z

- Customer Account Flow, Provider Dashboard Flow built; verifying-payment state; sign-in (then) as emailed link.

### 2026-09-15T00:20:00Z

- Read product docs, auth, account settings, discover and public provider page to ground mockups.
- Round 1: three mobile directions plus a provider-side set (1c cut).
- Round 2: single merged direction — white, all-sans, #8c2b52 accent.

## Locked decisions

- Provider page: design 8b, locked 16 Sep 2026 — `Ceaute Provider Page.dc.html`.
- Profile order: identity + bio, portfolio, treatments (3 + see-all), reviews, policies, similar providers.
- Full treatment list on its own `/@username/treatments` page, groups as sticky sections.
- Swipe hero with a plain `1 / 9` counter, no strip and no invented affordance.
- Chips filter treatments only; portfolio is not coupled to them.
- White surface, all-sans (Geist), `#8c2b52` accent on primary actions and links.

## Product rules to preserve (from docs/product.md)

- 15-minute slot grid; 24h minimum notice; 60-day window; Europe/London. Not provider-configurable.
- One continuous working period per weekday plus whole blocked dates.
- Hold: 5 min at creation, extended to Checkout expiry (~31 min) when Stripe opens.
- Payment: full or fixed deposit (> £0); cancellation window 12/24/48h; late cancellation retains the commitment amount, refunds the rest.
- Checkout requires full name + UK phone before the hold is created; continuing to payment is the terms acceptance.
- Exact address only after paid confirmation; public area before.
- Add-on ↔ treatment compatibility is many-to-many, edited from the add-on side.
- Reviews: one per completed booking, 1–5 + comment, first name shown; providers cannot delete.
- Not implemented: reminders, SMS, distance search, provider replies, recurring exceptions.
- Auth: emailed 6-digit code, verified on `/verify`; resend has a cooldown and a new code invalidates the previous one. Never a magic link, never a password.
- Checkout can bounce back with `payment=unavailable|expired|processing`; each needs an in-page notice (copy in checkout-payment-notice.js).
- Booking emails are sent by a cron job — confirmation/receipt may lag the confirmed screen by minutes.
- Email content is one structured object rendered to both HTML and text; a booking fact cannot appear in one and not the other. Cancellation emails deliberately omit the private address; provider emails alone carry customer email and phone.
- /terms and /privacy are drafts pending owner and legal review: the draft notice and every Owner TODO must stay visible.
- Root route (`/`) currently renders an empty main — needs the conditional redirect decided in System Screens.
- `/help` exists in the repo but is being deleted; `error.tsx` links to it and needs that link removed.
- `/auth/error` is a static card with one link to `/sign-in` — no form, no resend. Its copy still says "link" from the magic-link era and needs updating to "code".
- A bad `@username` hits the ROOT `not-found.tsx` (the `[username]` segment has no not-found file), so it cannot echo the handle or localise suggestions. Adding `[username]/not-found.tsx` would allow both.
- `error.tsx` already provides `reset()`, a `describeRouteError` heading/message and a conditional digest reference — designs must use those, not invent a Reload.
- Stripe return page only reads state; the webhook confirms → design a "verifying payment" interstitial.
- Cancellation is recorded before the refund; refund can be pending/failed → show refund status, never assume completion.
- Publishing checklist: display name, username, category, bio, active location, working hours, ≥1 active categorised treatment, booking terms, ≥1 visible portfolio image, Stripe recipient account.
- Dashboard sections: profile (portfolio, preview), locations, availability, treatments, add-ons, treatment-groups, bookings, settings (booking, payments).
- Portfolio images carry optional captions; review visibility is moderated (providers cannot delete).

## Known gaps — resolved 16 Sep 2026

- Verifying-payment interstitial added (Booking Flow 07b). Sign-in corrected to emailed link.
- Refund status shown on cancelled booking detail (Customer Account Flow).
- Reminders toggle removed; customer settings rebuilt (Customer Account Flow).
- Provider Dashboard Flow built: onboarding, overview (checklist + published), page/portfolio, location, availability, catalogue (treatments/groups/add-ons), bookings, booking detail, booking terms, payments.

## Design divergences from live code (intentional)

- Treatment details sheet with add-ons — now matched upstream by treatment-selection.jsx (bottom sheet in code; the spec draws it as a centred modal).
- Reviews section hidden when empty (code: dashed empty state).
- "Similar providers" section (code: none — discover has no ranking).
- Dashboard menu drawer (8 items) becomes a 5-item nav strip (Today · Bookings · Treatments · Page · Settings); groups and add-ons are tabs inside Treatments, location and hours inside Page.
- Booking detail "Message" button is a placeholder — provider replies are not implemented.
- Delete account is not in the code; kept as a design placeholder.

## Screen map

| Screen | Built from |
| --- | --- |
| Discover (Customer Booking Flow 01, states) | src/app/discover/page.jsx, src/app/discover/actions.js |
| Provider page (Ceaute Provider Page, Booking Flow 02) | src/app/(public-provider)/[username]/_components/storefront-page.jsx, _lib/storefront-view-model.js |
| Treatments page (Ceaute Provider Page) | _lib/storefront-view-model.js (treatment_sections) |
| Treatment detail + add-ons (Booking Flow 04) | src/app/(public-provider)/[username]/book/[treatmentId]/page.jsx |
| Pick a time (Booking Flow 05) | book/[treatmentId]/time/page.jsx, book/_components/booking-scheduler.jsx, book/_lib/appointment-availability.js |
| Sign in (Booking Flow 06) | src/app/(authenticate)/** |
| Review & pay, payment failed (Booking Flow 07, states) | book/[treatmentId]/checkout/page.jsx, book/actions.js |
| Confirmed (Booking Flow 08) | src/app/(account)/account/bookings/[bookingId]/page.jsx, docs/product.md |
| Policies (Provider Page) | src/app/(dashboard)/dashboard/settings/booking/_components/booking-settings-form.jsx |
| Sign in / sign up / enter code (Customer Account Flow, App, Booking Flow 06, Prototype) | src/app/(authenticate)/**, (authenticate)/_components/verify-code-form.jsx, (authenticate)/actions.js |
| Bookings list, detail, cancel, refund, review (Customer Account Flow) | src/app/(account)/account/bookings/**, docs/product.md |
| Customer settings (Customer Account Flow) | src/app/(account)/account/settings/** |
| Onboarding (Provider Dashboard Flow) | src/app/(dashboard)/dashboard/onboarding/** |
| Overview + publish checklist (Provider Dashboard Flow) | dashboard/_components/dashboard-overview.jsx, dashboard/profile/publication-readiness.js |
| Page / portfolio (Provider Dashboard Flow) | dashboard/profile/**, dashboard/profile/portfolio/** |
| Location (Provider Dashboard Flow) | dashboard/locations/** |
| Availability (Provider Dashboard Flow) | dashboard/availability/** |
| Catalogue: treatments, groups, add-ons (Provider Dashboard Flow) | dashboard/treatments/**, dashboard/treatment-groups/**, dashboard/add-ons/** |
| Provider bookings + detail (Provider Dashboard Flow) | dashboard/bookings/** |
| Booking terms (Provider Dashboard Flow) | dashboard/settings/booking/** |
| Booking emails, 6 events (System Screens) | src/lib/emails/email-layout.js, booking-email-content.js, api/cron/send-booking-emails/route.ts |
| Sign-in code email (System Screens) | (authenticate)/actions.js + Supabase template (not in repo) |
| /terms, /privacy (System Screens) | src/app/(site)/terms/page.tsx, privacy/page.tsx, _components/legal-page.jsx |
| Checkout bounce-backs, 3 states (System Screens) | book/_lib/checkout-payment-notice.js, book/actions.js |
| /auth/error, not-found, error (System Screens) | src/app/auth/error/page.tsx, src/app/not-found.tsx, src/app/error.tsx, (public-provider)/[username]/page.jsx |
| Root route decision (System Screens) | src/app/page.tsx |
| Payments / Stripe states (Provider Dashboard Flow) | dashboard/settings/payments/page.jsx, src/app/api/stripe/connect/route.ts |
