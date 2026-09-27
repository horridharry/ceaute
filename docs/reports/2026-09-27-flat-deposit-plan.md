# Flat deposit: approved build plan

Dated snapshot, 27 September 2026. Produced by the `ceaute-change` plan stage for [decision 008](../decisions/008-flat-deposit.md) and its follow-up decisions in the `ceaute-product-design` references, revised with the plan reviewers' six minor points, and approved by the owner on 27 September 2026 with one addition: T8 closes the review-to-hold gap in this build. Check any claim here against the code and migrations: this file does not describe current behaviour.

Branch: `flat-deposit`. Target: Preview only. One-way door: yes (booking snapshot gains `deposit_kind` and `deposit_amount_pence`). Migration: yes (`202609270002_flat_deposit_terms.sql`).

## Summary

Implement decision 008 (flat deposit) on branch flat-deposit, target Preview. PostgreSQL stays authoritative: a new migration 202609270002_flat_deposit_terms.sql adds provider_booking_setting.deposit_amount_pence (whole pounds in pence, set only for a flat deposit). It replaces the 3-argument booking_terms_are_complete and booking_payment_terms with 4-argument versions that accept a flat deposit. Due now is least(price, flat), and a late cancellation keeps all of it, so it is never more than was paid. Percentage and full payment are unchanged. The migration re-adds provider_booking_setting_percentage_terms (same name, NOT VALID, so pre-006 rows stay saved and incomplete). It redefines provider_page_publication_check_values and create_validated_booking_hold as copies of their 202609270001 bodies. The hold snapshot gains a deposit_kind marker ('flat' | 'percentage' | null for full) and deposit_amount_pence. get_public_booking_terms is recreated to return deposit_kind and deposit_amount_pence. claim_booking_checkout, prepare_booking_cancellation, the webhook and the booking summary functions already read amount_due_now_pence / commitment_amount_pence, so they are untouched. JavaScript then follows. booking-terms.js mirrors and parses the flat kind. The Booking settings form gains the Flat amount / Percentage sub-choice, the £ field, the flat explanation and the reworded pre-006 notice. publication-checks.js gets the new setup and pause strings. booking-money.js learns the flat kind and the case where the booking costs less than the deposit ('Pay now', the note, 'keeps the full £8'), and readers accept snapshots without the marker. /terms gets the approved Paying and late-cancellation text with no agreement-version or date change. Docs (product, domain, architecture, an implementation note on decision 008) and the already-edited skill references are committed with the change. No refactors. Nothing is applied to production.

## What changes for people

- Booking settings: 'Payment when booking' still offers Deposit and Full payment. The Deposit hint now reads 'Customers pay a deposit when they book and the rest at the appointment.' When Deposit is chosen, a second choice appears, 'Flat amount' (selected by default) and 'Percentage'. A provider already on a percentage deposit sees Percentage selected, with their percentage kept (provider-experience.md, Booking Settings; decision 008).
- Flat amount shows a '£' field labelled 'Deposit amount', hint 'Whole pounds, at least £1. The same for every treatment.' It starts empty with no suggested figure. Anything that is not whole pounds of at least £1 shows 'Enter a deposit in whole pounds, at least £1.' There is no maximum.
- One flat amount applies to the whole business, whatever the Treatment or Add-ons chosen. Treatment Groups play no part in it.
- The Booking settings explanation for a flat deposit (e.g. £15, 24 hours) reads: 'Customers pay £15 when they book. The rest is paid to you at the appointment. If they cancel less than 24 hours before, you keep the £15.' Then the £40 example '£15 now, £25 at the appointment.' Then 'If a booking costs less than £15, they pay the whole price when they book.' The Percentage and Full payment wording is unchanged.
- Full payment is unchanged: it still has its percentage (10-100% in steps of 5), which is what a late cancellation keeps.
- Setup guide task and Publication checklist detail read 'Full payment or a deposit, and a cancellation window'. The pause reason on a live page reads 'Choose your booking terms in Booking settings'.
- Settings saved before decision 006 still count as incomplete and are not converted. The flat field is not prefilled from an old fixed £ deposit. The notice is titled 'Choose your booking terms' and reads 'Your old £X deposit no longer applies to new bookings, and your page isn't taking new bookings until you save your terms. Bookings already made keep their terms.' On a draft the second clause is '...and you can publish once you save your terms.' A draft cannot publish and a live page takes no new bookings until terms are saved.
- Customer Review and pay, the held page and the booking pages for a flat deposit: the amount reads 'Deposit to pay now', with no percentage. The rest reads 'Pay {provider} at the appointment'. The late-cancellation line reads '{Provider} keeps your £15 deposit.'
- When a booking (Treatment plus Add-ons) costs less than the flat deposit, e.g. an £8 Treatment under a £10 deposit: the customer pays the whole £8 now. The amount reads 'Pay now', with no 'at the appointment' line. The note reads 'The £10 deposit is more than the price, so you pay the whole price now.' The late-cancellation line reads '{Provider} keeps the full £8.' Nothing is due at the appointment. A late cancellation keeps the £8 and refunds nothing.
- When a booking costs exactly the flat deposit, it follows the deposit wording ('Deposit to pay now', 'keeps your £X deposit'), with nothing due at the appointment. The decision's 'less than' rule does not apply because the deposit is not more than the price.
- A late customer cancellation of a flat-deposit booking keeps the whole flat deposit (never more than was paid) and refunds anything above it. An early cancellation or any provider cancellation refunds everything, as today. The cancel dialog keeps today's amount-based wording ('keeps the £15 you paid. There's no refund.' / 'Cancel and refund £x').
- Provider booking detail and cards show the amount paid online and the amount to collect at the appointment from the stored amounts, as today. A flat deposit simply produces different figures.
- /terms Paying section is replaced by the approved text: 'Each provider chooses whether customers pay the full price when booking or a deposit. A deposit is either a fixed amount set by the provider, of at least £1, or a percentage of the booking price between 10% and 90% and at least £1. A deposit is never more than the booking price. Checkout shows which applies, how much is due now, and how much is due at the appointment.' The Stripe and offline-balance paragraphs stay.
- /terms 'Cancel after the deadline' bullet is replaced by the approved text: 'Cancel after the deadline and the provider keeps the amount shown to you at checkout, never more than you paid online. With a deposit that is the whole deposit; with full payment it is the percentage the provider set. Anything you paid above that is refunded. Bookings keep the terms they were made on.' The page date, PROVIDER_AGREEMENT_VERSION and provider acceptance are unchanged. Providers are not asked to accept again.
- Not covered by a decision, and reworded only as far as needed so no Flat-amount screen tells the provider to choose a percentage (the owner checks these in the keyboard pass on Preview; they are not open decisions): (a) the Booking settings explanation while the flat field is empty (today 'Choose a percentage to see what customers pay.'; suggested 'Enter a deposit amount to see what customers pay.'); (b) the generic save failure (today '...Check the percentage and try again.'; suggested '...Check your booking terms and try again.'); (c) the pre-006 notice for an old full-payment late-cancellation amount keeps its own subject ('Your old £X late-cancellation amount') inside the new 'Choose your booking terms' notice. Everything else not covered, such as switching between Flat amount, Percentage and Full payment and what each field remembers, keeps today's behaviour.
- 'Continue to payment' also checks that the amount kept after a late cancellation is the one Review and pay showed. If the provider changed it in between (for example Full payment at 50% to a flat deposit at or above the price), the customer sees 'Check the updated price' on the held page instead of going to Stripe (owner decision, 27 September 2026).

## What must not change

- Percentage deposits stay valid and are never converted: 10-90% in steps of 5, at least £1.00, never more than the price, the percentage of the whole booking price (Treatment and Add-ons), rounded once to the nearest penny with halves up by PostgreSQL (decision 006; decision 008 'Percentage deposits stay valid'; docs/product.md Payments and booking history).
- Full payment is unchanged: the whole price is paid now, and a late cancellation keeps the provider's percentage (10-100% in steps of 5), never more than was paid (decision 008; decision 006; docs/domain.md The booking contract).
- A deposit is never more than the price. A flat deposit is whole pounds, at least £1, one amount for the whole business (decision 008).
- The amount due now and the amount kept after a late cancellation are worked out once by PostgreSQL when the hold is made and stored on the booking. Review and pay shows PostgreSQL's quote. JavaScript only formats stored pence (decision 006; decision 008; docs/product.md Review and pay).
- 'Continue to payment' checks the held amounts equal what was reviewed and stops on 'Check the updated price' if they differ. The checkout claim refuses an amount that differs from the booking (docs/product.md; decision 006).
- Bookings keep the terms they were made on. Existing bookings, including pre-006 fixed amounts and £0 kept for a blank retained amount, are never recalculated from current settings. Readers accept older booking records that lack the new deposit-kind marker (decision 002; decision 006; decision 008 Consequences; docs/domain.md).
- Settings saved before decision 006 are kept exactly, never converted, and count as incomplete: a draft cannot publish, and a published page stays visible but takes no new bookings. Ceaute never unpublishes a page by itself (decision 006; docs/product.md Payments and booking history, publication paragraph).
- An early customer cancellation and any provider cancellation refund the full online amount. A late customer cancellation keeps at most the stored late-cancellation amount and refunds the rest. Cancellation releases the time immediately while the refund is recorded and retried (docs/product.md Cancellation, completion, and reviews; decision 003).
- Any balance after a deposit is due at the appointment and collected outside Ceaute. There is no pay-later option (docs/product.md Payments and booking history; docs/domain.md).
- The provider bears Stripe processing and Ceaute's 2% platform fee, charged only on money processed through Ceaute and never on the offline balance (docs/product.md; decision 004).
- A Stripe return URL never confirms a booking. Only the signed webhook plus PostgreSQL confirms it (docs/product.md; decision 003; AGENTS.md).
- The customer does not choose between full payment and deposit. Offering several payment options is a future idea, not MVP (customer-experience.md Confirm and Pay; undecided.md Payment-choice evolution).
- The storefront has no Booking terms section. Payment, the cancellation window, the late-cancellation outcome and the written policy are shown at Review and pay, the held page and the booking pages, which link to /terms and /privacy (docs/product.md).
- Cancellation window stays 12, 24 or 48 hours, and the optional written policy is unchanged. House rules are a separate decision, not part of this change (provider-experience.md Booking Settings).
- Booking settings exposes a business policy, not refund or payment infrastructure: no Stripe or refund mechanics shown (provider-experience.md Cancellation window; copy.md Avoid).
- Publication stays deliberate and only on Settings > Publication. Complete booking terms remain one of the eight requirements (docs/product.md; provider-experience.md Publication readiness).
- Paused pages still say they aren't 'taking online bookings right now' and show no Book buttons (docs/product.md).
- No new provider agreement version: PROVIDER_AGREEMENT_VERSION and the /terms date stay, and providers do not re-accept (customer-experience.md Confirm and Pay, owner decision of 27 September 2026).
- Private address release rules are untouched (decision 002; docs/product.md).
- Terminology: Treatments, Treatment Groups and Add-ons as in docs/domain.md, never 'Catalogue'. Booking terms, Deposit, Full payment, paid now, due at the appointment and keeps are the domain words (docs/domain.md; SKILL.md; copy.md).
- Copy rules: sentence case, no em dashes in customer or provider copy, say whether money moved (copy.md).

## Tasks

### T1: Migration: flat deposits in PostgreSQL (setting, check, money rule, quote, hold snapshot)

Protected: yes. Files: `supabase/migrations/202609270002_flat_deposit_terms.sql`, `supabase/tests/database/percentage_booking_terms.test.sql`, `scripts/db-races/booking-races.sh`

Load the supabase-postgres-best-practices skill first. Do NOT edit any existing migration. Create supabase/migrations/202609270002_flat_deposit_terms.sql with a header comment citing docs/decisions/008-flat-deposit.md and saying nothing here reads or rewrites an existing booking snapshot. Do these steps in this order:
(1) `alter table ceaute.provider_booking_setting add column deposit_amount_pence integer;` plus a comment: 'Flat deposit in pence, a whole number of pounds of at least £1. Set only for a flat deposit; null for a percentage deposit and for full payment.'
(2) `create function ceaute.booking_terms_are_complete(target_payment_mode text, target_deposit_percent integer, target_deposit_amount_pence integer, target_cancellation_window_hours integer) returns boolean language sql immutable set search_path = ceaute, public`. The body is `select coalesce(target_cancellation_window_hours in (12,24,48) and ( (target_payment_mode = 'full' and target_deposit_amount_pence is null and target_deposit_percent % 5 = 0 and target_deposit_percent between 10 and 100) or (target_payment_mode = 'deposit' and target_deposit_amount_pence is null and target_deposit_percent % 5 = 0 and target_deposit_percent between 10 and 90) or (target_payment_mode = 'deposit' and target_deposit_percent is null and target_deposit_amount_pence >= 100 and target_deposit_amount_pence % 100 = 0) ), false);`. There is no upper limit on the flat amount.
(3) `alter table ceaute.provider_booking_setting drop constraint provider_booking_setting_percentage_terms;` then re-add it with the SAME name: `check (ceaute.booking_terms_are_complete(payment_mode, deposit_percent, deposit_amount_pence, cancellation_window_hours) and commitment_amount_pence is null) not valid;`. Add a comment that NOT VALID keeps pre-006 rows exactly as saved and incomplete.
(4) `create function ceaute.booking_payment_terms(target_total_price_pence bigint, target_payment_mode text, target_deposit_percent integer, target_deposit_amount_pence integer)`. It has the same return table and the same language, volatility and search_path as the 202609230001 version. It raises 'Invalid booking payment terms.' when the price is null or negative, or when booking_terms_are_complete(mode, percent, amount, 24) is false. If mode = 'deposit' and target_deposit_amount_pence is not null: due_now := least(total, amount), and it returns (due_now, total - due_now, due_now). Otherwise it keeps the 202609230001 percentage body unchanged: `(total*percent+50)/100`, deposit = least(total, greatest(pct,100)), full = total, and retained = least(pct, due_now).
(5) `create or replace function ceaute.provider_page_publication_check_values(uuid)`: copy the body verbatim from 202609270001_availability_drops.sql (lines 776-858). Change only the has_booking_terms call so it passes provider_booking_setting.deposit_amount_pence as the third argument. Its header comment says it is redefined from 202609270001 with only the booking-terms value changed.
(6) `drop function ceaute.get_public_booking_terms(uuid, bigint);` then recreate it from the 202609230001 body (lines 381-446). The return table becomes: payment_mode text, deposit_percent smallint, deposit_kind text, deposit_amount_pence integer, cancellation_window_hours smallint, written_policy text, accepts_new_bookings boolean, amount_due_now_pence bigint, amount_due_later_pence bigint, late_cancellation_retained_pence bigint. deposit_kind = `case when setting.payment_mode = 'deposit' then case when setting.deposit_amount_pence is not null then 'flat' else 'percentage' end end`. It uses the 4-argument completeness and money calls, and returns the new columns in both return-query branches. Re-issue `revoke all ... from public, anon, authenticated, service_role; grant execute ... to authenticated, service_role;` and the existing comment.
(7) `create or replace function ceaute.create_validated_booking_hold(uuid, uuid, uuid, uuid[], timestamptz)`: copy verbatim from 202609270001_availability_drops.sql lines 510-762. Change only two things. First, the booking_payment_terms call passes booking_setting.deposit_amount_pence as the 4th argument. Second, in service_snapshot, right after 'deposit_percent', add `'deposit_kind', case when booking_setting.payment_mode = 'deposit' then case when booking_setting.deposit_amount_pence is not null then 'flat' else 'percentage' end end,` and `'deposit_amount_pence', booking_setting.deposit_amount_pence,`. Then re-issue its revoke all and `grant execute ... to service_role`.
(8) Only after steps 3-7: `drop function ceaute.booking_payment_terms(bigint, text, integer); drop function ceaute.booking_terms_are_complete(text, integer, integer);`.
(9) On both new functions, `revoke all ... from public, anon, authenticated, service_role; grant execute ... to authenticated, service_role;`, the same as 202609230001.
(10) Update the comments on the column provider_booking_setting.deposit_percent ('Percentage deposit or full-payment percentage; null for a flat deposit') and on the function provider_page_accepts_new_bookings(uuid) ('Published, complete booking terms, Stripe ready, current agreement accepted and no outstanding balance.').
Leave these untouched: claim_booking_checkout, prepare_booking_cancellation, the webhook confirmation, get_provider_booking_summaries/get_customer_booking_summaries, current_provider_agreement_version and get_public_booking_settings.
Then update supabase/tests/database/percentage_booking_terms.test.sql. (a) Every existing booking_payment_terms(price, mode, percent) call becomes booking_payment_terms(price, mode, percent, null), with expectations unchanged. (b) The block that drops and re-adds provider_booking_setting_percentage_terms re-adds it with the new 4-argument expression. (c) Add flat cases: booking_payment_terms(4000,'deposit',null,1500) = (1500,2500,1500); (800,'deposit',null,1000) = (800,0,800), the booking cheaper than the deposit; (1000,'deposit',null,1000) = (1000,0,1000); (100000,'deposit',null,500000) = (100000,0,100000), no maximum. These raise 'Invalid booking payment terms': amount 1550, amount 50, amount 0, percent 30 together with amount 1500, and 'full' with amount 1500. booking_terms_are_complete is true for ('deposit',null,1500,24) and false for ('deposit',30,1500,24) and ('full',50,1500,24). Settings: an owner update to payment_mode 'deposit', deposit_percent null, deposit_amount_pence 1500 lives_ok, and has_booking_terms and provider_page_accepts_new_bookings are then true. Updates with deposit_amount_pence 1550, or with a flat amount plus a percent, throw provider_booking_setting_percentage_terms. A hold made on a £15 flat setting snapshots payment_mode 'deposit', deposit_kind 'flat', deposit_amount_pence 1500, a null deposit_percent, amount_due_now_pence 1500 and commitment_amount_pence 1500. For a £10 flat deposit on a total under £10 (use an existing treatment of at least £1 and under the flat amount, or a fixture treatment priced 800), the hold snapshots amount_due_now_pence = commitment_amount_pence = the total. A percentage hold snapshots deposit_kind 'percentage'. get_public_booking_terms for the flat setting and 4000 returns (flat,1500,t,1500,2500,1500). A late customer cancellation of a confirmed flat snapshot {payment_mode deposit, deposit_kind flat, deposit_amount_pence 1500, amount_due_now_pence 1500, commitment_amount_pence 1500, total 4000}, paid 1500, retains 1500 and refunds 0 through prepare_booking_cancellation; follow the existing cancellation-section pattern (lines 315-417). An early cancellation of the same snapshot refunds 1500. (d) Update select plan(57) to the new total. Keep the legacy fixed-deposit and agreement-version assertions as they are.

Also (from plan review): (c) in percentage_booking_terms.test.sql add one assertion, following the pattern at line 390, that prepare_booking_cancellation(..., 'provider') on a confirmed flat snapshot of 1500 refunds 1500. (d) In scripts/db-races/booking-races.sh line 42, the B2 consistency check calls the 3-argument booking_payment_terms, which this migration drops; pass (service_snapshot->>'deposit_amount_pence')::int as the 4th argument. Change nothing else in the script.

Tests:

- supabase/tests/database/percentage_booking_terms.test.sql (updated signatures plus new flat cases, plan count updated)
- npm run test:db on a freshly reset local database (npx supabase db reset) — all database test files, including mvp_booking_rules, publication_checks_and_agreement, payment_integrity_hardening and availability_drops, still pass
- scripts/db-races/booking-races.sh B2 still reports consistent=true against the migrated local database

### T2: booking-terms.js: mirror, parse and exemplify flat deposits

Protected: yes. Files: `src/lib/payments/booking-terms.js`, `tests/booking-terms.test.js`

In src/lib/payments/booking-terms.js, update the header comment: a deposit is a flat whole-£ amount or a percentage (decisions 006 and 008), and PostgreSQL still owns the rules. Add `export const DEPOSIT_KINDS = Object.freeze(["flat", "percentage"]);`.
areBookingTermsComplete({ paymentMode, depositPercent, depositAmountPence, cancellationWindowHours }) mirrors the new SQL exactly. Treat null, undefined and "" as absent. The window must be in CANCELLATION_WINDOW_HOURS, and then one of these holds: (full: the amount is absent and the percent is in percentOptions('full')); (deposit: the amount is absent and the percent is in percentOptions('deposit')); (deposit: the percent is absent and the amount is an integer >= 100 with amount % 100 === 0).
isLegacyBookingSetting passes setting.deposit_amount_pence through as well.
parseBookingTermsForm({ paymentMode, depositKind, depositPercent, depositAmount, cancellationWindowHours, writtenPolicy }):
- The mode error is unchanged.
- When mode === 'deposit', the kind must be in DEPOSIT_KINDS, else errors.deposit_kind = 'Choose a flat amount or a percentage.'.
- For a flat kind: trim, strip one leading '£' and trim again. The input must match /^\d{1,7}$/ and the number must be >= 1, else errors.deposit_amount = 'Enter a deposit in whole pounds, at least £1.'. The percent is ignored.
- For a percentage kind, or for full, the percent validation and messages are exactly as today.
- values always include deposit_amount_pence: for flat it is pounds * 100 with deposit_percent: null; otherwise deposit_amount_pence: null. commitment_amount_pence: null stays.
bookingTermsExample({ paymentMode, depositKind, depositPercent, depositAmountPence }):
- For deposit + flat with a complete amount, it returns { pricePence: 4000, payNowPence: min(4000, amount), laterPence: 4000 - payNow, keptPence: payNow, refundedPence: 0, flatPence: amount }.
- The percentage and full branches are unchanged, but completeness is checked with the new signature, where the amount is absent.
- It returns null when incomplete.
Do not change percentOptions or maximumPercent. Do not touch src/lib/payments/provider-liability.js or PROVIDER_AGREEMENT_VERSION.
In tests/booking-terms.test.js, update the existing parse expectations to include deposit_amount_pence: null and depositKind: 'percentage' where the mode is deposit. Add these cases:
- completeness true for deposit/flat 1500 and deposit/flat 100000.
- completeness false for 1550, 50, a flat amount together with a percent, and full with an amount.
- isLegacyBookingSetting is false for a saved flat row.
- parse flat '15' and '£15' gives { payment_mode: 'deposit', deposit_percent: null, deposit_amount_pence: 1500, ... }.
- parse flat '15.50', '0', '' and 'abc' gives deposit_amount 'Enter a deposit in whole pounds, at least £1.'.
- parse deposit with no kind gives the deposit_kind error.
- bookingTermsExample flat 1500 gives payNow 1500, later 2500, kept 1500, refunded 0.
- bookingTermsExample flat 5000 gives payNow 4000 and later 0.
Keep the PROVIDER_AGREEMENT_VERSION cross-check test unchanged; it must still pass.

Tests:

- tests/booking-terms.test.js (updated plus new flat cases; PROVIDER_AGREEMENT_VERSION check unchanged and passing)

### T3: Booking settings screen: Flat amount / Percentage, £ field, explanation, pre-006 notice, save error

Protected: yes. Files: `src/app/(dashboard)/dashboard/settings/booking/queries.js`, `src/app/(dashboard)/dashboard/settings/booking/actions.js`, `src/app/(dashboard)/dashboard/settings/booking/_components/booking-settings-form.jsx`, `tests/dashboard-screens.test.js`

Load the ceaute-product-design skill before writing visible copy; where no decision covers a detail, keep today's behaviour and list it for the owner's keyboard pass rather than choosing silently.
Read the relevant guide in node_modules/next/dist/docs/ for server actions and client components first.
queries.js:
- Add deposit_amount_pence to the select.
- Compute `complete` with the new areBookingTermsComplete signature.
- Return deposit_kind: 'percentage' when complete and payment_mode === 'deposit' and deposit_percent is not null; otherwise 'flat'. A new provider, a legacy fixed deposit and a full-payment provider all default to flat.
- Return deposit_amount: complete && deposit_amount_pence != null ? String(deposit_amount_pence / 100) : ''. It is never prefilled from commitment_amount_pence.
- deposit_percent: complete && deposit_percent != null ? String(deposit_percent) : ''.
- payment_mode, legacy and pageStatus are unchanged.
actions.js:
- Pass depositKind: formData.get('deposit_kind') and depositAmount: formData.get('deposit_amount') to parseBookingTermsForm.
- Change the 23514 message to "Those booking terms can't be saved. Check your booking terms and try again.".
- Update the comment to 'complete booking terms'.
booking-settings-form.jsx:
- The Deposit hint becomes 'Customers pay a deposit when they book and the rest at the appointment.'. The Full payment hint is unchanged.
- Add state depositKind (initial settings.deposit_kind) and depositAmount (initial settings.deposit_amount).
- When paymentMode === 'deposit', render directly after the Payment when booking fieldset a second fieldset with `<legend className="sr-only">Deposit</legend>`. It holds two radios with name 'deposit_kind' in the existing radio markup style: value 'flat', label 'Flat amount' (listed first), and value 'percentage', label 'Percentage'. They have no hints and show fieldErrors.deposit_kind like payment_mode.
- When paymentMode === 'deposit' and depositKind === 'flat', render Field label 'Deposit amount', htmlFor 'deposit_amount', hint 'Whole pounds, at least £1. The same for every treatment.', error fieldErrors.deposit_amount. Inside it goes the same £-prefixed Input pattern as treatment-form.jsx lines 136-150: type text, name deposit_amount, inputMode numeric, no placeholder, controlled by depositAmount.
- Render the existing percentage Select Field (unchanged labels, hints and options) only when paymentMode === 'full' or depositKind === 'percentage'.
- choosePaymentMode keeps its current behaviour. depositAmount and depositPercent keep their values while the provider switches kind or mode.
- Explanation receives depositKind and depositAmountPence (whole-pound Number(depositAmount) * 100 when /^\d+$/ matches and is >= 1, else null). For deposit + flat: with no valid amount it returns 'Enter a deposit amount to see what customers pay.'. Otherwise, with amount = formatPricePence(flatPence), it renders 'Customers pay {amount} when they book. The rest is paid to you at the appointment. If they cancel less than {windowHours} hours before, you keep the {amount}.' Then a `mt-1 block text-ink-muted` span 'On a {price} booking: {payNow} now, {later} at the appointment.' from bookingTermsExample. Then another `mt-1 block text-ink-muted` span 'If a booking costs less than {amount}, they pay the whole price when they book.'. The percentage-deposit and full-payment branches and their empty state 'Choose a percentage to see what customers pay.' are unchanged.
- LegacyNotice: the title is 'Choose your booking terms'. Delete the sentence 'Booking terms are now a percentage of the booking price.'. The body is '{oldTerm} no longer applies to new bookings, and {consequence}. Bookings already made keep their terms.' consequence is 'your page isn’t taking new bookings until you save your terms' when published, else 'you can publish once you save your terms'. oldTerm is unchanged, so the full-payment case still says 'Your old £X late-cancellation amount'.
- Use no em dashes. Use sentence case.
tests/dashboard-screens.test.js:
- The first test passes deposit_kind 'percentage' and deposit_amount '' and keeps its percentage assertions. Also assert the radios 'Flat amount' and 'Percentage' and the new Deposit hint.
- Add a test for deposit_kind 'flat' with deposit_amount '15' and a 24-hour window. It asserts '>Deposit amount</label>', the hint text, name="deposit_amount", no deposit_percent select, 'Customers pay £15.00 when they book.', 'you keep the\s*(<!-- -->)?£15.00', 'On a £40.00 booking: £15.00 now, £25.00 at the appointment.' and 'If a booking costs less than\s*(<!-- -->)?£15.00, they pay the whole price when they book.'. Allow React's <!-- --> separators as the existing tests do.
- Add a test for flat with an empty amount that asserts 'Enter a deposit amount to see what customers pay.'.
- Update the legacy test to assert 'Choose your booking terms', 'Your old £45.00 deposit', 'your page isn’t taking new bookings until you save your terms' and that 'Booking terms are now a percentage' is absent. Add a draft variant asserting 'you can publish once you save your terms'.

Also (from plan review): in tests/dashboard-screens.test.js the legacy fixture must be one a pre-006 provider really produces: payment_mode 'deposit', deposit_kind 'flat', deposit_amount '' and legacy amountPence 4500. Assert the Deposit amount input has no value of 45 and that 'Enter a deposit amount to see what customers pay.' appears, for both the published and the draft notice. Update the stale queries.js comment ('A legacy fixed deposit becomes a deposit that still needs a percentage') to say it lands on Deposit > Flat amount with the field empty.

Tests:

- tests/dashboard-screens.test.js (updated percentage test; new flat, empty-flat, legacy published and legacy draft tests)
- tests/import-boundaries.test.js still passes

### T4: Setup guide, Publication checklist and pause reason wording

Protected: no. Files: `src/app/(dashboard)/dashboard/_lib/publication-checks.js`, `tests/dashboard-your-page.test.js`

In SETUP_TASKS, change the 'terms' detail to 'Full payment or a deposit, and a cancellation window'. In PAUSE_REASONS, change the has_booking_terms label to 'Choose your booking terms in Booking settings'. Change nothing else. In tests/dashboard-your-page.test.js line 129, change the regex to match 'Choose your booking terms in Booking settings'. If any other test pins the old detail string (grep tests for 'a percentage and a cancellation window'), update it to the new string.

Tests:

- tests/dashboard-your-page.test.js (pause label)
- any test pinning the setup detail string

### T5: Customer money wording: flat deposit and booking cheaper than the deposit

Protected: yes. Files: `src/lib/bookings/booking-money.js`, `src/app/(public-provider)/[username]/book/[treatmentId]/checkout/_components/booking-summary.jsx`, `tests/booking-money.test.js`

Load the ceaute-product-design skill before writing visible copy; where no decision covers a detail, keep today's behaviour and list it for the owner's keyboard pass rather than choosing silently.
booking-money.js still does no arithmetic beyond comparing and formatting stored pence. Update the header comment to mention flat deposits.
describe() gains the inputs depositKind and depositAmountPence. It returns depositKind (depositKind ?? null) and flatDepositPence (for depositKind === 'flat', pence(depositAmountPence); else null). It also returns depositCoversPrice = isDeposit && depositKind === 'flat' && flatDepositPence > total, which is strictly greater, so an equal price keeps the deposit wording. For flat, percent is null.
termsFromQuote passes depositKind: quote.deposit_kind, depositAmountPence: quote.deposit_amount_pence and percent: quote.deposit_percent == null ? null : Number(quote.deposit_percent).
termsFromSnapshot passes depositKind: snapshot?.deposit_kind ?? null and depositAmountPence: snapshot?.deposit_amount_pence, with percent null when deposit_percent is null or undefined. legacy becomes `!snapshot?.deposit_kind && (snapshot?.deposit_percent === undefined || snapshot?.deposit_percent === null)`. Snapshots without the marker behave exactly as today.
payNowLabel returns 'Pay now' when !isDeposit || depositCoversPrice; otherwise its current percent logic is unchanged, so flat gives 'Deposit to pay now'.
lateCancellationSentence: in the lateRefundPence === 0 branch, use the deposit wording only when isDeposit && !depositCoversPrice; otherwise use `${name} keeps the full ${formatPounds(lateKeepPence)}.`. The other branches are unchanged.
paymentView adds depositCoversPriceNote: depositCoversPrice ? `The ${formatPounds(flatDepositPence)} deposit is more than the price, so you pay the whole price now.` : null.
cancellationPreview and snapshotPriceLines are unchanged.
In booking-summary.jsx PaymentBlock, after the minimumApplied note, render `{money.depositCoversPriceNote ? <p className="mt-2 text-[13px] text-ink-muted">{money.depositCoversPriceNote}</p> : null}`.
In tests/booking-money.test.js, keep E1-E10 unchanged and add these flat cases:
- F1 snapshot {payment_mode 'deposit', deposit_kind 'flat', deposit_amount_pence 1500, deposit_percent null, total 4000, amount_due_now 1500, commitment 1500, window 24}: payNowLabel 'Deposit to pay now', dueLater '£25.00', note null, sentence 'Glow keeps your £15.00 deposit.', a late cancellationPreview 'keeps the £15.00 you paid. There’s no refund.' and confirm label 'Cancel booking', an early preview refunding £15.00, and legacy false.
- F2 {flat 1000, total 800, due 800, commitment 800}: label 'Pay now', dueLater null, note 'The £10.00 deposit is more than the price, so you pay the whole price now.', sentence 'Glow keeps the full £8.00.'.
- F3 {flat 1000, total 1000, due 1000, commitment 1000}: label 'Deposit to pay now', dueLater null, note null, sentence 'Glow keeps your £10.00 deposit.'.
- F4: termsFromQuote with {accepts_new_bookings true, payment_mode 'deposit', deposit_kind 'flat', deposit_amount_pence 1500, deposit_percent null, amount_due_now 1500, amount_due_later 2500, late_cancellation_retained 1500} matches F1's payment view.
- A percentage snapshot without deposit_kind still labels 'Deposit to pay now (30%)'.

Tests:

- tests/booking-money.test.js (E1-E10 unchanged, new F1-F4 and no-marker case)
- tests/checkout-display.test.js, tests/booking-card-money.test.js, tests/booking-display.test.js, tests/booking-payments.test.js and tests/booking-fee-split.test.js still pass unchanged

### T6: /terms: approved Paying and late-cancellation wording

Protected: yes. Files: `src/app/(site)/terms/page.tsx`, `tests/legal-pages-copy.test.js`

In src/app/(site)/terms/page.tsx, replace only the first <p> of the 'Paying: full payment or a deposit' section with this exact approved text: 'Each provider chooses whether customers pay the full price when booking or a deposit. A deposit is either a fixed amount set by the provider, of at least £1, or a percentage of the booking price between 10% and 90% and at least £1. A deposit is never more than the booking price. Checkout shows which applies, how much is due now, and how much is due at the appointment.' The Stripe paragraph and the offline-balance paragraph stay unchanged. Replace the text after '<strong>Cancel after the deadline</strong>' in that <li> with the exact approved text: 'and the provider keeps the amount shown to you at checkout, never more than you paid online. With a deposit that is the whole deposit; with full payment it is the percentage the provider set. Anything you paid above that is refunded. Bookings keep the terms they were made on.' Keep the heading text, the updated="27 September 2026" date, every other section, PROVIDER_AGREEMENT_VERSION, docs/provider-agreement-draft.md and the SQL agreement version unchanged. In tests/legal-pages-copy.test.js, add assertions that the terms source contains 'A deposit is either a fixed amount set by the provider, of at least £1' and 'A deposit is never more than the booking price.' and 'keeps the amount shown to you at checkout, never more than you paid online' and 'With a deposit that is the whole deposit'. Also assert that it no longer contains 'The percentage is worked out to the nearest penny' or 'Bookings\s+made before percentages were introduced', and that it still contains updated="27 September 2026". Because JSX wraps lines, use regexes with \s+ between words.

Tests:

- tests/legal-pages-copy.test.js (new /terms assertions)
- tests/booking-terms.test.js PROVIDER_AGREEMENT_VERSION cross-check still passes
- npm run check:legal

### T7: Docs: product, domain, architecture, decision 008 implementation note, skill references

Protected: no. Files: `docs/product.md`, `docs/domain.md`, `docs/architecture.md`, `docs/decisions/008-flat-deposit.md`, `docs/design-system.md`, `.agents/skills/ceaute-product-design/references/provider-experience.md`, `.agents/skills/ceaute-product-design/references/customer-experience.md`

docs/product.md:
- Line 33: 'complete booking terms (a percentage, see Payments)' becomes 'complete booking terms (a flat deposit, a percentage deposit or full payment, see Payments)'.
- In Payments and booking history (lines 394-412), say that booking terms are Deposit or Full payment and a cancellation window. A deposit is either a flat amount in whole pounds, at least £1, one amount for the whole business and the default, or a percentage (10–90% in steps of 5, at least £1.00). Full payment keeps a percentage (10–100%) for late cancellation. A deposit is never more than the price: a booking that costs less than the flat deposit is paid in full now and nothing is due at the appointment. After a late customer cancellation the provider keeps the whole flat deposit, the percentage deposit's percentage or the full-payment percentage, never more than was paid. Cite decision 008 next to decision 006. Change 'until a percentage is chosen' to 'until terms are saved'. Keep the rounding, offline-balance and £0-kept sentences.
docs/domain.md, The booking contract (lines 71-96):
- Booking terms: Full payment or Deposit, where a Deposit is a flat amount or a percentage, and the cancellation window.
- Say what is paid now and kept for each: flat means least(flat, price) is paid now and all of it is kept; percentage and full are as today.
- The service snapshot list adds 'deposit kind (flat or percentage; absent on bookings made before decision 008)' and 'flat deposit amount' beside payment mode and percentage.
docs/architecture.md:
- In the line 46 Booking terms row, change 'provider_booking_setting_percentage_terms (new writes)' to note it now accepts flat deposits (the name is kept), and cite decision 008 alongside 006 for booking_payment_terms.
- Invariants at lines 201-205: 'complete percentage booking terms' becomes 'complete booking terms (flat or percentage deposit, or full payment)', and 'the pence a percentage becomes' becomes 'the pence a deposit or percentage becomes'.
- Line 352: 'stores the percentage terms' becomes 'stores the booking terms, including the deposit kind,'.
docs/decisions/008-flat-deposit.md: append an 'Implementation' section. It names provider_booking_setting.deposit_amount_pence, and the 4-argument booking_terms_are_complete and booking_payment_terms that replace the 3-argument ones in 202609270002_flat_deposit_terms.sql. It says the snapshot keys are deposit_kind ('flat' | 'percentage', absent for full payment and for older bookings) and deposit_amount_pence. It adds that readers treat a missing deposit_kind by today's percentage and legacy rules, and that the constraint keeps its name. The Decision section is unchanged.
docs/design-system.md line ~182: check only, and change it only if it is no longer accurate.
The two .agents skill reference files already carry the 27 September decisions as uncommitted edits: do not edit them, and include them in the change. Use no em dashes in any user-facing quote.

Also: the decision 008 Implementation note records that 'Continue to payment' now also compares the amount kept after a late cancellation with what Review and pay showed (T8, owner decision 27 September 2026). docs/product.md, where it describes 'Check the updated price', says the late-cancellation amount is compared too.

Tests:

- No automated test; reviewed against the migration and code in the verification lane

### T8 (runs before T7): Review-to-hold guard also checks the late-cancellation amount

Protected: yes. Files: `src/app/(public-provider)/[username]/book/actions.js`, `src/app/(public-provider)/[username]/book/[treatmentId]/checkout/page.jsx`, `tests/review-guard.test.js`

Owner decision 27 September 2026: close the gap where 'Continue to payment' compared only the amount due now and the total. Example: Priya is on Full payment keeping 50%; a customer reviews a £40 booking; Priya switches to a £40 flat deposit before the customer continues. Due now and total still match, but the hold would keep £40 after a late cancellation where Review showed £20. After this task the customer lands on the held page with the existing 'Check the updated price' notice (notice=terms_changed) instead of going to Stripe.
checkout/page.jsx: in the hidden fields (around line 204), add expected_kept_pence: String(terms?.late_cancellation_retained_pence ?? ""). Change nothing else.
actions.js continueToPayment: read const expectedKeptPence = wholePence(formData.get("expected_kept_pence")) next to the other two expected values. After heldTotal, read const heldKept = wholePence(booking.service_snapshot?.commitment_amount_pence). Add expectedKeptPence === null || heldKept !== expectedKeptPence to the existing condition that redirects to `${returnPath}&notice=terms_changed`. Update the step-3 comment at the top of the function to say the late-cancellation amount is compared too. Change nothing else: resumeCheckout, openCheckoutForHold and claim_booking_checkout are untouched, and no JavaScript computes money.
tests/review-guard.test.js (new, node:test, reading the two source files as text, in the style of tests/storefront-route-boundaries.test.js): assert the page posts expected_kept_pence from late_cancellation_retained_pence, and that actions.js compares commitment_amount_pence against expected_kept_pence in the same terms_changed condition.

Tests:

- tests/review-guard.test.js (new)
- npm test, lint, typecheck and build still pass

## Decision record

Amend docs/decisions/008-flat-deposit.md with an Implementation note: the setting column deposit_amount_pence, the snapshot keys deposit_kind and deposit_amount_pence, and readers treating a missing deposit_kind as today's percentage/legacy rules

## Docs to update

- docs/product.md: line 33 publication requirement; Payments and booking history paragraph (flat default, whole £ at least £1, cheaper-than-deposit paid in full now, late cancellation keeps whole flat deposit); 'until a percentage is chosen' -> 'until terms are saved'
- docs/domain.md: The booking contract (Deposit is flat or percentage; what is paid now and kept for each) and the service snapshot list (deposit kind, flat amount)
- docs/architecture.md: Booking terms row (line 46, cite decision 008), invariants list (lines 201-205), hold description (line 352)
- docs/decisions/008-flat-deposit.md: Implementation note (deposit_amount_pence, deposit_kind snapshot marker, 4-argument functions, readers accept snapshots without the marker)
- docs/design-system.md ~line 182: check only
- src/app/(site)/terms/page.tsx: approved Paying and late-cancellation text (task T6)
- .agents/skills/ceaute-product-design/references/provider-experience.md and customer-experience.md: commit the existing uncommitted edits unchanged

## Acceptance

- **automated**: npm test, npm run lint, npm run typecheck and npm run build all pass; booking-terms, booking-money, dashboard-screens, dashboard-your-page and legal-pages-copy tests cover the flat cases
- **database**: On a freshly reset local database (npx supabase db reset), npm run test:db passes, including the new flat cases in percentage_booking_terms.test.sql: the money rule for £15 of £40, £10 flat on £8, equal price and no maximum; the check refusing 1550, 50, and flat plus percent; the flat hold snapshot with deposit_kind and deposit_amount_pence; the quote; and a late cancellation keeping 1500 and refunding 0
- **database**: Existing percentage settings and pre-008 bookings are untouched after the migration. A percentage provider still gets E1-E10 amounts and the '(30%)' label. A pre-006 fixed-deposit row is still saved as it was, has_booking_terms is false, and its page takes no new bookings
- **browser**: Booking settings on Preview: Deposit shows Flat amount (default) and Percentage. The £ field has the approved label, hint and error. The flat explanation shows £15/24h with the £40 example and the costs-less line. The empty flat explanation and the save-failure copy are reworded. A percentage provider sees Percentage selected with their percentage
- **browser**: Setup guide task and Publication checklist detail read 'Full payment or a deposit, and a cancellation window'. The pause reason on Today, Booking settings and Publication reads 'Choose your booking terms in Booking settings'
- **browser**: Pre-006 provider (dev data only, never production): the 'Choose your booking terms' notice shows published and draft wording, the flat field is not prefilled, a draft cannot publish and a live page shows no Book buttons until terms are saved
- **browser**: Review and pay and the held page for a £15 flat provider on a £40 booking show 'Deposit to pay now £15.00', 'Pay {provider} at the appointment £25.00' and '{Provider} keeps your £15.00 deposit.'. An £8 booking under a £10 deposit shows 'Pay now £8.00', no at-the-appointment line, the 'more than the price' note and 'keeps the full £8.00.'
- **stripe**: A Stripe test-mode checkout for a flat-deposit booking charges exactly the snapshot's amount_due_now_pence, is confirmed only by the signed webhook, and the platform fee applies only to the online amount
- **browser**: A late customer cancellation of a confirmed flat-deposit booking keeps the deposit with no refund (dialog: 'keeps the £15.00 you paid. There’s no refund.'). An early cancellation refunds everything ('Cancel and refund £15.00'). Provider booking detail shows the amount paid online and the amount to collect from stored amounts
- **email**: Booking-confirmation and cancellation emails for a flat-deposit booking show the correct amounts (the emails read stored amounts and are not changed by this work)
- **browser**: Review-to-hold guard: on Preview, open Review and pay for a Full payment 50% provider on a £40 booking, switch the provider to a £40 flat deposit in another tab, then Continue to payment: the held page shows 'Check the updated price' and the new late-cancellation line, and Stripe does not open
- **owner-keyboard**: The owner's keyboard pass on Preview: the Flat amount and Percentage radios, the £ field, switching between Flat, Percentage and Full payment (what each field remembers), the sr-only 'Deposit' legend, the £X.00 formatting in the new copy, and the /terms wording, the 'On a £40.00 booking:' prefix before the approved '£15 now, £25 at the appointment.' line, and the new 'Choose a flat amount or a percentage.' error (reachable only through a crafted request)

## Risks

- Snapshot shape change (one-way door): new holds write deposit_kind and deposit_amount_pence, and flat snapshots have deposit_percent null. Any reader that treats a null deposit_percent as 'legacy' mislabels flat bookings. booking-money.js is fixed in T5, and booking-display.js and booking-card-money.js read only stored amounts, but the verification lane should grep again for deposit_percent readers.
- The migration drops the 3-argument booking_terms_are_complete and booking_payment_terms. plpgsql and SQL function bodies do not record dependencies, so a missed caller would fail only at runtime. Callers are provider_page_publication_check_values, get_public_booking_terms, create_validated_booking_hold, the table check and percentage_booking_terms.test.sql and scripts/db-races/booking-races.sh (fixed in T1). All are redefined or updated, and test:db must pass on a fresh reset.
- The hold and publication-check functions are copied verbatim from 202609270001. A copy drift, such as losing the drop-date or lock logic, would silently change availability rules. Review them with a diff against 202609270001 lines 510-768 and 776-858.
- get_public_booking_terms is dropped and recreated, so its return type changes. Its grants must be re-issued, or Review and pay breaks. During a Preview deploy, an older app build calling it by named arguments still works because the new columns are additive.
- Copy formatting: the existing formatters render '£15.00', while the approved examples read '£15'. The plan keeps today's formatters for consistency. The owner checks this in the keyboard pass.
- Flat input accepts up to 7 digits (£9,999,999) because deposit_amount_pence is an integer. That is a column limit, not a product maximum, and larger input shows the standard error.
- Uncovered details keep today's behaviour and are left to the owner's keyboard pass: the sr-only 'Deposit' legend, the deposit_kind error text (reachable only through a crafted request), and the £40 example line when the flat deposit is £40 or more ('£40.00 now, £0.00 at the appointment').
- Production is untouched: the migration goes to Preview only. Promoting to main needs the owner's explicit approval under docs/release.md.

## Plan review

Two reviewers (invariants, product and scope) raised six minor points and no blockers. All six are folded in above: the race script caller (T1), a provider-cancellation assertion (T1), the pre-006 legacy fixture and stale comment (T3), loading `ceaute-product-design` for visible copy (T3, T5), `/terms` marked protected (T6), and the review-to-hold guard, which the owner chose to fix now (T8).
