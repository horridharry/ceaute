# MVP UI implementation plan — 18 September 2026

Consolidates the eight-phase build order in `design_handoff_ceaute_mvp/05-build-order.md`
into three milestones. Written on branch `feat/design-system` at commit `77ff4cb`, after
reading every file in `design_handoff_ceaute_mvp/` — six Markdown documents and eight
`.dc.html` design references — and auditing the routes and modules each one describes.

Nothing here changes an approved product decision. Where a design reference and the
written specification disagree, the disagreement is recorded in §6 rather than settled.

---

## 1. Why three milestones instead of eight

The original eight phases are a good build sequence but a poor delivery plan: phases 3, 4,
5 and 7 are all the same activity — put the design onto routes that already work — split
by audience rather than by risk. That split creates four review gates where one would do,
and it hides the two things that actually gate the work: the navigation decision, and the
handful of queries the designs need but the database does not yet answer.

The three milestones group by what has to be true before the next step can start:

| Milestone | The question it answers |
| --- | --- |
| 1 · Design foundations | Do we have a vocabulary to build screens out of? |
| 2 · UI implementation | Does every route speak it, with behaviour unchanged? |
| 3 · Validation and release | Does the whole journey work, on a phone, end to end? |

---

## 2. What is actually implemented today

Established by reading the code, not the documentation.

### 2.1 Complete and committed on this branch

| Work | Commit | Notes |
| --- | --- | --- |
| Tokens, Geist, plum palette swap | `a7b4dff` | Original Phase 0 |
| 31 components | `bd71c1f` | Original Phase 1 |
| 5 screen templates | `77ff4cb` | Original Phase 2 |

The `.field`, `.label` and `.field-set` classes were rewritten to the input spec, so all
~75 existing form controls already render in the new style. No other product markup has
been touched, and no route imports the component kit or templates yet.

### 2.2 Business logic that exists and must not change

Auth as an emailed 6-digit code verified at `/verify`, with resend cooldown and
invalidation of the previous code. The 15-minute grid, 24-hour notice, 60-day window and
`Europe/London`. Hold creation and its extension to the Stripe Checkout expiry. Stripe
Connect onboarding, Checkout, and webhook-confirmed payment. Cancellation, refund, and
refund retry including the recovery cron. The booking-email outbox and its cron. Reviews,
portfolio signed URLs, and RLS throughout. 52 migrations are the authority for all of it.

Three things the divergence report lists as problems are **already resolved in code**:

- **A7** — `shouldShowReviewsSection()` exists and the storefront already hides the
  reviews section when empty.
- **B2** — `error.tsx` already has only two links; the `/help` link is gone.
- **B3** — there is no `/help` route in the repository, and the legal footer does not
  link to one.

Two modules exist but nothing renders them:

- `publication-readiness.js` computes all ten checklist items; only `profile/actions.js`
  consumes it. The checklist UI (**A5**) is presentation work with no new query.
- `checkout-payment-notice.js` holds the copy for all three bounce-back states; no screen
  presents them as designed (**A11**).

### 2.3 Routes that exist but render pre-design markup

Every customer and provider route. The ones that differ from the design structurally, not
just cosmetically:

| Route | Today | Design |
| --- | --- | --- |
| `/` | empty `<main>` | conditional redirect (**B8**) |
| `/discover` | area text field + category `<select>` in a form | masthead / search input / chips / cards, plus an area picker |
| `/@username` | no hero, portfolio as a 2-up grid, all treatments inline, no commit bar | swipe hero, See-all links, 3 treatments, policies, commit bar |
| `/@username/book/[id]/time` | month label with every date and its slots listed | five-day strip, day name, 3-per-row grid |
| `/dashboard` | a link grid titled "Overview" | Today, or the publishing checklist when draft |
| dashboard nav | 8-item drawer behind a Menu button | 5-item visible strip (**B7**) |
| `/auth/error` | magic-link era copy (**B1**) | code-era copy |

### 2.4 Screens and routes that do not exist at all

`/@username/treatments` · `[username]/not-found.tsx` (**A9**) · the Confirming
interstitial (**A6** — Stripe currently returns to the checkout page with
`checkout=success`) · the publishing checklist UI (**A5**) · the provider Today view
(**A2**) · the area picker (**A12**) · Similar providers (**A8**) · the three bounce-back
screens (**A11**) · the four letter screens (Confirmed, Published, Cancelled, and
whichever fourth is agreed — see D7) · `Mark done` (**A3**) and the photo prompt (**A4**).

---

## 3. Milestone 1 · Design foundations

**Status: substantially complete.**

### Scope
Colour, typography, spacing, the component library and the five templates.

### Deliverables
Delivered in `a7b4dff`, `bd71c1f` and `77ff4cb`. Two dev-only review surfaces exist at
`/design-system` and `/design-system/templates`, both unreachable in production.

### Dependencies
None.

### Completion criteria
- [x] No `pink-*` remains; one font family; no monospace.
- [x] Every component in `02-components.md` exists with its documented states.
- [x] Every template in `03-screens.md` exists as a layout component.
- [x] `lint`, `typecheck`, 158 tests and `build` all pass.
- [ ] Decisions **D1**, **D7** and **D11** in §5 are settled. Milestone 2 cannot start
      without D11, and cannot finish without D1.

### Remaining work
The decisions only. No further code.

---

## 4. Milestone 2 · UI implementation

Put the design onto the routes. Behaviour is preserved exactly; the only new server work
is the four queries in §4.6, which are tracked separately so a UI change never hides a
data change.

### 4.1 Navigation spine — do this first, everything sits under it

Nothing else can be reviewed honestly until the page furniture is settled, because three
templates supply their own nav and the root layout currently renders `<AppHeader />` on
every route (**D11**).

- Move `<AppHeader />` out of `layout.tsx` into the screens that want the root bar.
- Provider nav strip replaces the drawer (**B7**); groups and add-ons become tabs inside
  Treatments, location and hours tabs inside Page.
- Root route redirect (**B8**), and point the wordmark at `/discover` or `/dashboard`
  rather than `/`.
- Customer avatar menu as the designed popover.

**Depends on:** M1, D11. **Blocks:** everything below.

### 4.2 Customer booking path — the revenue path, built end to end

`/discover` (both states, chips, search) → `/@username` (locked design 8b, swipe hero) →
`/@username/treatments` (**new route**, sticky group sections) → treatment modal
(restyled centred, **A1** — selection logic untouched) → pick a time (**T4**) → sign in
(six-cell code) → Review & pay → Confirming interstitial (**new**, **A6**) → Confirmed
(**T5**).

**Depends on:** 4.1. Optionally D2 (Similar providers) and D3 (area picker) — both are
additive sections and can be cut without blocking the path.

### 4.3 Customer account

`/account/bookings` with tabs and the awaiting-review group → booking detail in its three
states, including refund status on a cancelled booking (**A10** — the data is already
read; only the presentation is missing) → cancel flow stating the two figures → review
submission → `/account/settings`.

**Depends on:** 4.1. Independent of 4.2.

### 4.4 Provider side

Today (**A2**, needs the loader in §4.6) → publishing checklist (**A5**) → Page and
portfolio → Location with its public/private split → Availability → Treatments, groups,
add-ons → Bookings and detail → Booking terms → Payments → Onboarding → the Published
letter.

**Depends on:** 4.1, and the Today loader.

### 4.5 Edges

The three bounce-backs (**A11**) — `processing` first, because it is the one that can
cause a double charge → `/auth/error` copy (**B1**) → `not-found` and `error` copy →
`[username]/not-found.tsx` (**A9**) → legal pages, keeping the draft notice and every
Owner TODO → email restyle plus **B4** and **B5**.

**Depends on:** 4.1. Otherwise independent — can run alongside 4.3 and 4.4.

### 4.6 Backend work, tracked separately

These are the only server-side changes Milestone 2 needs. Each is a read; none touches a
booking, payment or publication invariant, and none belongs in the same commit as a UI
change.

| # | Work | Needed by | Note |
| --- | --- | --- | --- |
| S1 | Today and Next-up booking loader for `/dashboard` | A2 | The data exists; the query does not |
| S2 | `from £{n}` and `Next free` for the provider page commit bar | `/@username` | Min price is derivable from the view model; "next free" runs the existing availability calculator |
| S3 | A provider to suggest on the root `not-found` | not-found | One published provider, any area |
| S4 | Handle-aware suggestions for `[username]/not-found.tsx` | A9 | Same category and area as the missing handle |

`booking-email-content.js` changes for **B4** (drop the Where section for providers,
rephrase payment rows from her side) and **B5** (`Find another time` action, and state
that a provider cancellation never retains money) are content, not schema, but they sit in
a backend module and ship as their own commit.

### Completion criteria
- [ ] Every route in `03-screens.md` renders from a template and the component kit.
- [ ] Every item in §A that is not deferred by a decision is built; every item in §B fixed.
- [ ] The fifteen-point checklist in `05-build-order.md` passes.
- [ ] No server action, data loader, validation rule or route behaviour changed, except
      the four reads in §4.6 and the two email content changes.
- [ ] `lint`, `typecheck`, tests and `build` green.

---

## 5. Milestone 3 · Validation and release

### Scope
Prove the journeys, fix what they surface, confirm the breakpoints, prepare the merge.

### Deliverables
- A booking made end to end on a real phone, one-handed, at 390px, and repeated at 1280px.
- The provider journey from onboarding to a published page to a booking in the diary.
- The three bounce-backs exercised deliberately, `processing` included.
- Defects found in the above, fixed.
- A decision on the two dev-only galleries: keep them behind the production guard, or
  delete them before merge.
- `npm run test:db` if Docker is available on the machine, noted as skipped if not.
- A pull request against `main`. The Phase 0 palette swap is already its own commit, so
  the reviewable design work is not buried beneath it.

### Dependencies
Milestone 2 complete.

### Completion criteria
- [ ] Both journeys complete without a dead end.
- [ ] The `05-build-order.md` review checklist passes in full.
- [ ] No console errors, no layout shift on commit, no horizontal scroll at 390px.
- [ ] Focus is visible and trapped where it should be; tap targets meet 44px.
- [ ] `lint`, `typecheck`, tests, `build` green; PR open.

---

## 6. Phase-to-milestone mapping

Every original phase and every numbered divergence, so nothing is lost.

| Original | Lands in | State |
| --- | --- | --- |
| Phase 0 · Tokens and palette | M1 | Done (`a7b4dff`) |
| Phase 1 · Components | M1 | Done (`bd71c1f`) |
| Phase 2 · Templates | M1 | Done (`77ff4cb`) |
| Phase 3 · Customer booking path | M2 §4.2 | To do |
| Phase 4 · Customer account | M2 §4.3 | To do |
| Phase 5 · Provider side | M2 §4.4 (nav strip promoted to §4.1) | To do |
| Phase 6 · Mark done + photo prompt | Deferred — see **D4** | Not scheduled |
| Phase 7 · Edges | M2 §4.5 | To do |
| Review checklist | M3 | To do |

| Divergence | Lands in | State |
| --- | --- | --- |
| A1 · Centred treatment modal | M2 §4.2 | To do |
| A2 · Provider Today | M2 §4.4 + S1 | To do |
| A3 · `Mark done` | Deferred — **D4** | Not scheduled |
| A4 · Photo prompt | Deferred — **D4** (needs schema) | Not scheduled |
| A5 · Publishing checklist UI | M2 §4.4 | To do — no new query |
| A6 · Confirming interstitial | M2 §4.2 | To do |
| A7 · Hidden reviews section | — | **Already in code** |
| A8 · Similar providers | M2 §4.2 if kept — **D2** | Undecided |
| A9 · `[username]/not-found.tsx` | M2 §4.5 + S4 | To do |
| A10 · Refund status on cancelled booking | M2 §4.3 | Data exists; presentation missing |
| A11 · Three bounce-backs | M2 §4.5 | Copy exists; screens missing |
| A12 · Area picker | M2 §4.2 if kept — **D3** | Undecided |
| B1 · `/auth/error` copy | M2 §4.5 | To do |
| B2 · `error.tsx` `/help` link | — | **Already in code** |
| B3 · Legal footer `/help` | — | **Already in code** |
| B4 · Provider email Where section | M2 §4.6 | To do |
| B5 · `provider_cancelled_customer` action | M2 §4.6 | To do |
| B6 · Pink palette | M1 | Done |
| B7 · Dashboard nav strip | M2 §4.1 | To do |
| B8 · Root route | M2 §4.1 | To do |

---

## 7. Decisions needed

### D1 · How much desktop? — blocks the end of Milestone 2
`03-screens.md` says the content column is 720px centred and exactly three things change
on desktop: the provider nav becomes a left column, modals become popovers, and the
portfolio becomes a 2-up grid. `Ceaute Desktop.dc.html` shows something much larger:
1440px frames with a 1280px content width, a two-column provider page with a sticky
booking-summary panel, a persistent summary through the booking steps, and a dashboard
sidebar. The file labels these "direction A — the one you picked".

These are materially different amounts of work. The templates as built follow
`03-screens.md`. **Recommendation:** ship the 720px version for the MVP and treat the
desktop panel as post-launch; it is a second layout for the booking path, not a restyle.

### D2 · Similar providers (A8) — build or cut?
No ranking exists. The handoff itself says cut it for launch if the query is not trivial.
**Recommendation:** cut. It is one section on one page and the honest version — same
category, same area, ordered by rating — still needs a query nobody has asked for.

### D3 · Area picker (A12) — build or cut?
Needs a grouped count query. The handoff says cut it if areas stay few enough to fit a
chip row. With twelve providers they do. **Recommendation:** cut; revisit on volume.

### D4 · `Mark done` and the photo prompt (A3, A4) — defer?
Phase 6 is marked optional and needs a nullable `treatment_id` on the portfolio image —
the only schema change in the whole handoff. **Recommendation:** defer past this branch.
The cron already completes bookings, so nothing is broken without it.

### D5 · "Three other nail techs in Salford have Wednesday free"
The `provider_cancelled_customer` email design carries this line, and the design file
calls it "the one new query needed". **Recommendation:** drop the line for launch. The
email still offers `Find another time`, which is the substance of B5.

### D6 · The root redirect's fourth case
Three of the four cases are cheap. "Mid-booking with a live hold → back to the held
booking" means a hold lookup on every hit of `/`. **Recommendation:** ship the three
cheap cases; the wordmark will point at `/discover` or `/dashboard`, so the costly case
is reached only by typing the bare domain mid-booking.

### D7 · How many letter screens? — blocks Milestone 1 close
`03-screens.md` says three (Confirmed, Published, Cancelled). The MVP spec and the Phase 1
review checklist both say four, adding "Link sent" — which is magic-link vocabulary from
before auth became a 6-digit code. **Recommendation:** three, and treat the `/verify`
screen as an ordinary T3 form.

### D8 · The save/favourite heart on the provider page hero
`03-screens.md` specifies "back and save buttons as 32px translucent circles", and
`Ceaute App.dc.html` refers to "saved providers". There is no favourite, save or wishlist
anywhere in the code or in the 52 migrations. **Recommendation:** render the back control
only. Adding a save is a new feature with a schema change behind it.

### D9 · `Delete account`
The row is in the design; the process does not exist. **Recommendation:** keep the row,
point it at the support email already used in the legal pages, and label it honestly.

### D10 · `Message` on the provider booking detail
A placeholder in the design; provider replies are explicitly out of scope.
**Recommendation:** drop the button and keep `Call`, which is a `tel:` link that works.

### D11 · `<AppHeader />` in the root layout — blocks Milestone 2
It renders on every route. T2 and T4 supply a stacked nav, T3 a modal nav, and T5 must
have nothing in the top right. The first screen to adopt a template will have two headers.
**Recommendation:** move it out of `layout.tsx` into the screens that want it, as the
first task of §4.1.

### D12 · Two destinations referenced but never designed
The provider page links `See all 9` (a full-screen gallery) and `All 34` (a reviews page).
`Ceaute Provider Page.dc.html` lists both as open. **Recommendation:** point `See all` at
`/@username/treatments` where it applies, and drop the portfolio and reviews See-all links
until those pages are designed — a link to nothing is worse than no link.

---

## 8. Design inconsistencies found while reading

Recorded so they are not mistaken for requirements. The README names
`Ceaute MVP Spec.dc.html` as the source of truth, and each of these is a case where
another file disagrees with it.

1. **`Ceaute App.dc.html` is a superseded iteration.** It specifies skeleton loading
   screens, a floating Menu pill for provider navigation, mono-caps labels, filled inputs
   everywhere, an emailed sign-in *link*, Morning/Afternoon slot grouping, and an
   area-first Discover. The MVP Spec contradicts every one of those. Treat the file as
   history.
2. **`Ceaute Signature Moments.dc.html` frames 01 and 02** still show "Send me a sign-in
   link" and "back from the email link". Auth is a code. `github.md` confirms the
   magic-link correction was reversed.
3. **Signature Moments frame 07** shows a four-item provider nav (Overview · Bookings ·
   Treatments · Page) against the locked five-item strip.
4. **`Ceaute Booking Prototype.dc.html`** says "We'll email you a link, no password" on
   the sign-in step, then renders the six-digit code screen immediately after.
5. **`Ceaute Desktop.dc.html`** direction A shows the dashboard sidebar with the old eight
   sections, against B7's five. See also D1.
6. Signature Moments is labelled "experiments", with frames tagged MVP or DREAM. Only the
   letter screens named in `03-screens.md` are in scope; frame 08 is explicitly a dream
   needing scheduled email.

---

## 9. Explicitly out of scope

Unchanged from `04-divergences-and-gaps.md`: reminders and SMS of any kind, rescheduling,
provider replies to reviews, distance or map-radius search, recurring availability
exceptions, messaging, and self-service account deletion. Everything in
`Ceaute Reframes.dc.html` — book-the-look, the rebook nudge, customer briefs,
search-by-date, the menu importer, natural-language treatment entry and the booking-led
home — is post-launch and is not to be built from.
