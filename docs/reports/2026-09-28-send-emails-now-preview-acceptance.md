# Send-now booking emails: Preview acceptance results

Dated snapshot, 28 September 2026. Results of the acceptance items for
[decision 009](../decisions/009-booking-emails-sent-immediately.md) (booking
emails sent straight after the event, the 10-minute sweep as the safety net),
run by the owner and an agent on Preview. Each item is verified or unverified
as [Verification](../verification.md) describes.

Merge `c4b5cfe` on Preview (deployment `ceaute-ojmo47e26`); no migration.
Outbox rows were read with `supabase db query` on `ceaute-dev` (SELECT only),
and request paths with `vercel logs`. Times are Europe/London. Test data left
on `ceaute-dev`: booking `83e8a607` paid and cancelled; `0dbc9624` and
`ce505fe1` cancelled by the customer; `2daf8a42` and `36cd44c8` cancelled by
the provider.

- **Verified, automated:** `npm test` 831/831 on the branch and again on the
  merged tree; typecheck, lint and `npm run build` pass.
- **Baseline, before the deploy:** booking `db34b0ac` (old deployment) had its
  confirmation emails sent about 3 minutes after they were queued and its
  cancellation emails about 10 minutes after, at the next cron runs.
- **Verified, Stripe test mode and database:** paying for `83e8a607` confirmed
  it through `POST /api/stripe/payments` at 00:29:29. Both
  `booking_confirmed_*` rows were queued at 00:29:30 and sent 0.4–0.6 s later.
- **Verified, database:** customer cancellation from My bookings
  (`POST /account/bookings/…`) of `0dbc9624`, `83e8a607` and `ce505fe1`: each
  pair of `customer_cancelled_*` rows was sent 0.5–3.9 s after it was queued.
  The slower ones ran a Stripe refund first.
- **Verified, database:** provider cancellation from the dashboard
  (`POST /dashboard/bookings/…`) of `2daf8a42` and `36cd44c8`: each pair of
  `provider_cancelled_*` rows was sent 3.0–3.4 s after it was queued.
- **Verified, database:** every row above is `sent`, attempt 1, with a Resend
  message id and one row per event and recipient. The 00:30 and 00:40 cron runs
  of `ceaute-send-booking-emails` returned `claimed: 0`, so the sweep found
  nothing left to send.
- **Verified, email (owner):** one copy of each confirmation and cancellation
  email arrived, with no noticeable wait.
- **Verified, logs:** Preview logged no errors during the test, and nothing
  matched "Immediate booking email pass failed" or "Could not schedule".
- **Unverified:** the late-payment refund email (a payment on an expired hold,
  or on a hold retired by a location move). It was not produced naturally, and
  test data was not manufactured for it. The same webhook call site covers it,
  as the placement test checks.
- **Unverified:** `npm run test:db` on a fresh reset. No migration changed.
- **Unverified:** a pass cut off mid-send and later recovered by the sweep.
  This is covered by design (the 5-minute claim lease), not by a test.
