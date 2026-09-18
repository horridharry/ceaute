# 05 · Build order

Suggested sequence for a branch such as `feat/design-system`. The principle: land the
mechanical changes first so every later screen is already speaking the right language,
then the shared components, then screens in the order a real user meets them.

Nothing here requires a data migration except phase 6, which is optional.

---

## Phase 0 · Tokens and the palette swap

1. Add the five colours plus amber to the Tailwind theme (`01-foundations.md`).
2. Load Geist 400/500/600. Remove any other family.
3. Replace every `pink-600` / `pink-700` / `pink-800` with the accent. Grep to confirm
   none remain.
4. Delete any monospace usage — there should be none anywhere in the product.

Mechanical, wide, and safe. Landing it first means every screen you touch afterwards
already looks broadly right, which makes review far easier.

**Done when:** no `pink-` in the codebase, no second font family, the app is recognisably
Ceaute.

---

## Phase 1 · Components

Build in this order — later ones use earlier ones:

1. Button (6 variants + loading), Input (5 states + all field types), the duration select.
2. Chip, segmented control, tabs, option card, toggle, checkbox.
3. Status dot, held row, notice (informational + problem), empty state.
4. Treatment row, add-on row, setting row.
5. Provider card, booking card, review card, summary card.
6. Top bar (3 variants), avatar menu, provider nav strip, commit bar.
7. Day strip and slot grid.
8. Modal shell (centred, scrim, shadow) — used by the treatment detail and area picker.

**Done when:** a page rendered from these components matches its frame in
`Ceaute MVP Spec.dc.html` §2 side by side.

---

## Phase 2 · The five templates

Turn T1–T5 into layout components. Every screen after this is assembly, and consistency
stops depending on discipline.

T5 (Letter) is worth its own component even though only three routes use it — the
constraint that nothing sits in the top right is easy to break by accident.

---

## Phase 3 · The customer booking path

The revenue path. Build it end to end and test it on a real phone before moving on.

1. `/discover` — both states, chips, search.
2. `/@username` — the locked 8b page, including the swipe hero.
3. `/@username/treatments` — groups as sticky sections.
4. Treatment modal — restyle to centred; keep the existing selection logic.
5. Pick a time — month header, five-day strip, three-per-row slots, `Continue`.
6. Sign in — six-cell code, resend cooldown.
7. Review & pay — name, phone, summary, the one-sentence terms.
8. Confirming interstitial (**new**, A6).
9. Confirmed — the letter.

**Done when:** a booking can be made on a phone, in one hand, without pinching.

---

## Phase 4 · Customer account

1. `/account/bookings` — tabs, cards, the awaiting-review group.
2. Booking detail — confirmed, cancelled (with refund status, A10), completed.
3. Cancel flow — the two-figure outcome, acknowledgement, cancel-then-rebook framing.
4. Review submission.
5. `/account/settings`.

---

## Phase 5 · Provider side

1. Nav strip (B7) — replaces the drawer. Do this first; everything else sits under it.
2. **Today** (A2) — the new loader plus the day view.
3. Publishing checklist (A5).
4. Page / portfolio.
5. Location — the public/private split.
6. Availability.
7. Treatments, groups, add-ons.
8. Bookings and booking detail.
9. Booking terms, payments.
10. Onboarding.

---

## Phase 6 · Optional, and genuinely new

`Mark done` (A3) and the photo prompt (A4). Needs a schema change — a nullable
`treatment_id` on the portfolio image. Do it only when phases 0–5 are landed and stable.

---

## Phase 7 · Everything around the edges

1. Root redirect (B8).
2. Three checkout bounce-backs (A11) — `processing` first; it is the one that can cause a
   double charge.
3. `/auth/error` (B1), `not-found`, `error` (B2).
4. Email restyle, plus B4 and B5.
5. Legal pages, keeping the draft notice and TODO callouts.
6. `[username]/not-found.tsx` (A9) if you want the handle echoed.

---

## Review checklist

Before opening the PR:

- [ ] No `pink-*` classes remain.
- [ ] One font family. No monospace anywhere.
- [ ] `#F7EDF1` (the old accent tint) appears nowhere.
- [ ] Every screen has **at most one** primary button.
- [ ] Every screen has **at most one** helper line.
- [ ] Status is a dot plus a word — no tinted pills.
- [ ] Problems are a hairline row with a red dot — no filled red boxes.
- [ ] No bottom tab bar. No floating menu pill.
- [ ] Task exits sit in the bottom third; the top right holds only the avatar.
- [ ] The letter voice appears on exactly four screens: Confirmed, Published, Link sent,
      Cancelled.
- [ ] No skeleton loaders. Spinners only inside committing buttons.
- [ ] No toasts. Notices are in-page.
- [ ] Reviewers shown by first name with a `/5` rating.
- [ ] Cancellation copy states amounts, never percentages.
- [ ] Cancellation emails contain no private address.
- [ ] Email ships the system font stack, not Geist.
- [ ] `/terms` and `/privacy` still show the draft notice and every Owner TODO.
- [ ] Tested one-handed on a real phone at 390px, and at 1280px.

---

## A note on the pull request

The palette swap will dominate the diff — around forty files changed for one colour. It is
worth landing phase 0 as its own PR so the reviewable design work is not buried beneath it.
