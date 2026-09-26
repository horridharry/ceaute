---
name: ceaute-release
description: Take a Ceaute change through release, from feature branch to preview and, when the promotion trigger is met, preview to main, stopping at each owner gate and ending with an honest release report. Invoke with /ceaute-release, optionally naming the branch or "promote".
disable-model-invocation: true
---

# Ceaute release

`docs/release.md` is the procedure and `docs/verification.md` is how results
are judged. Read both in full before any step. This skill does not restate
them: it puts the agent's work in order, marks where to stop for the owner,
adds a money check, and sets the shape of the final report. Where this file
and those documents differ, the documents win.

## 0. Establish the state

Run `git status`, `git branch -a` and `git log --oneline main..preview`. Do not
rely on remembered state. Then say which of these this run is, and stop if the
owner meant something else:

- **Feature to preview**: one or more feature branches not yet in `preview`.
- **Promotion**: `preview` to `main`. Only when a trigger in "When to promote
  to production" has happened or is about to. Ask the owner which one.

## 1. Feature to preview

1. Run the change checklist in `docs/engineering-principles.md`:
   `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`, and
   `npm run test:db` on a freshly reset local database when a migration or
   database test changed. A failure stops the release. Report the output.
2. List the branch's new files in `supabase/migrations/`. If there are any,
   **stop**: the owner applies them to `ceaute-dev` from their own terminal.
   Continue only once `npx supabase migration list` shows them applied.
3. **Stop** and confirm the merge order with the owner. Then merge each branch
   into `preview` with `--no-ff`, one merge per branch, and push.
4. Verify on Preview as `docs/verification.md` describes. Exercise every
   journey the change touches that crosses Stripe, email or sign-in. Run the
   money check below if it applies.

## 2. Promotion

Each numbered step needs the owner's explicit approval for that step alone.

1. List what production lacks:
   `git diff --name-only main..preview -- supabase/migrations`.
2. **Stop.** The owner runs the production migrations, dry run first, exactly
   as `docs/release.md` "Production migrations" says. Never handle the
   connection string. Read the owner's output from the terminal panel and
   check it against the list from step 1.
3. **Stop.** Then `git switch main && git merge --ff-only preview` and push.
   If `--ff-only` refuses, stop and ask. Never create a merge commit on
   `main`.
4. Smoke-test production signed out, as "Checking production" says. Anything
   that needs a published provider or a payment stays unverified on
   production.

## 3. Clean up

Delete merged feature branches, locally and on origin, after the owner agrees.
Update "Before the first alpha invitation" in `docs/release.md`: delete closed
items and add anything this release left unverified.

## Money check

Run this when the change touches prices, deposits, fees, refunds or payouts.
That includes `src/lib/payments/`, `src/lib/bookings/booking-money.js`, a
migration that changes `booking_payment_terms`, holds, checkout or refunds, and
the "Payments and booking history" or "Cancellation" sections of
`docs/product.md`.

1. Write down one worked example before testing: a treatment price, terms
   (Deposit or Full payment, the percentage, the window), and the expected
   amounts in pence:
   - amount due now;
   - Ceaute's fee: the 2% platform fee plus the estimated Stripe processing
     fee (`calculateBookingFeeSplit` in `src/lib/payments/booking-payments.js`);
   - what the provider receives;
   - the refund for an early customer cancellation, a late one, and a provider
     cancellation.

   The rules are in `docs/product.md` and decisions 004 and 006. The
   percentage becomes pence once, in PostgreSQL, rounded half up, and a deposit
   is at least £1.00.
2. Check that the unit tests cover the same example (`tests/booking-terms`,
   `booking-money`, `booking-fee-split`, `booking-payments`). If they don't,
   say so in the report.
3. On Preview, the owner makes one test-card payment. Compare the charge and
   `application_fee_amount` against the worked example, using the Stripe
   Dashboard in Test mode or read-only `stripe` CLI commands in test mode.
   Compare the booking's stored amounts too. For a refund, cancel and compare
   the refunded amount.
4. Report each amount as matched, mismatched (give both numbers) or
   unverified. A mismatch stops the release.

## Report

End every run with this report, and nothing that claims more than it shows:

- **Released:** branches and commits, and where they now are.
- **Migrations:** each one, the database it was applied to, and who applied
  it.
- **Checks:** each command and its result.
- **Verification:** each item as verified, unverified or waived
  (`docs/verification.md`). Keyboard activation stays unverified until the
  owner reports it.
- **Money check:** the worked example and the result, or "not applicable".
- **Left open:** what was added to "Before the first alpha invitation".
