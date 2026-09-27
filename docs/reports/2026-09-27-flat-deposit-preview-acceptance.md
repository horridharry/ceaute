# Flat deposit: Preview acceptance results

Dated snapshot, 27 September 2026. Results of the flat-deposit acceptance items
in the [flat-deposit plan](2026-09-27-flat-deposit-plan.md), run by the owner
and an agent on Preview. It covers the flat-deposit parts of the
[Preview acceptance script](2026-09-27-preview-acceptance-drops-and-flat-deposit.md);
the drop-opening and drop-editor steps (sections 2 and 3 of that script) were
not run here. Each item is verified or unverified as
[Verification](../verification.md) describes.

Migration `202609270002` applied to `ceaute-dev` by the owner; merge `55e2997` on Preview. Test data left on `ceaute-dev`: cluxeklaws on a £15 flat deposit, a drop of 28–30 September (9 am to 5 pm, open now), and one cancelled Stiletto booking.

- **Verified, automated:** `npm test` 825/825 on the merged tree; typecheck, lint of `src`, `tests` and `scripts`, and `npm run build` pass. (`npm run lint` across the repo fails only on files under `.claude/worktrees/`.)
- **Verified, database (not on a fresh reset):** the new migration and all 27 pgTAP files, including 81/81 in `percentage_booking_terms.test.sql`, pass inside a rolled-back transaction on the local database. `npm run test:db` after `npx supabase db reset` is unverified.
- **Verified, browser:** Booking settings shows Deposit > Flat amount (default) or Percentage, the £ field, hint and flat explanation, and a saved £15 survives a reload.
- **Verified, browser:** Review and pay for the £45 Stiletto: at £15, "Deposit to pay now £15.00", "Pay Cluxeklaws at the appointment £30.00", "keeps your £15.00 deposit"; at £50, "Pay now £45.00", no appointment line, "The £50.00 deposit is more than the price, so you pay the whole price now.", "keeps the full £45.00".
- **Verified, browser (T8):** Full payment 50% reviewed ("keeps 50% (£22.50)"), switched to a £50 flat deposit in another tab, then Continue to payment: "Check the updated price", Stripe not opened.
- **Verified, Stripe test mode:** Checkout charged £15.00; the booking shows Confirmed. The webhook delivery itself was not inspected in Stripe.
- **Verified, browser:** customer booking page (Paid online £15.00, £30.00 at the appointment) and provider booking detail (Confirmed, Paid online £15.00, To collect £30.00). Older percentage bookings keep their amounts.
- **Verified, browser:** early customer cancellation: dialog "Cancel and refund £15.00"; afterwards Refund £15.00, Kept by Cluxeklaws £0.00.
- **Verified, email (owner):** booking-confirmation and cancellation emails show the right amounts.
- **Verified, browser:** `/terms` carries both approved paragraphs verbatim; "Last updated 27 September 2026" unchanged.
- **Unverified on Preview:** a late customer cancellation (every booking needs 24 hours' notice, and the only dates 24–48 hours ahead were fully booked) and a provider cancellation of a flat booking; both pass in the database tests. The setup, checklist and pause wording and the pre-006 notice (unit tests only).
- **Unverified, owner keyboard pass:** the radios, the £ field, switching between Flat, Percentage and Full payment, the sr-only "Deposit" legend, the £X.00 formatting against the approved "£15", the "On a £40.00 booking:" prefix and the /terms wording.
