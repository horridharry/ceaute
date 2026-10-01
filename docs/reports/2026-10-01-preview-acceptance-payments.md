# Preview acceptance: declined card, provider cancellation, refund failure, 1 October 2026

One booking on Preview (`@cluxeklaws`, £15 flat deposit, 'French tips long'
on Saturday 3 October at 12:00) covered three open items. The owner drove the
customer and provider windows and read the emails; the agent read the Stripe
records with read-only `stripe` CLI calls in the "Ceaute Dev" sandbox and the
Vercel request logs.

| Item | Result | Evidence |
| --- | --- | --- |
| Declined card (bug 1 fix) | Verified | 4000 0000 0000 0002 declined at 18:51:41 (`payment_intent.payment_failed`, delivered, nothing pending); paying again on the same Checkout page with 4000 0000 0000 5126 confirmed the booking at 18:51:54 |
| Provider cancellation of a flat-deposit booking | Verified | Refund `re_3ULo8u…` £15.00 created 18:52:45; Ceaute fee 73p refunded; transfer £15 reversed. "Your provider cancelled a booking" (customer) and "You cancelled a booking" (provider) emails arrived, both "Refund £15.00, retained £0.00" |
| Refund failing after success (bug 2 fix) | Verified | Stripe moved the refund to `failed` (`expired_or_canceled_card`) and sent `refund.failed` at 19:07:16, about 15 minutes after the refund (the local sandbox took under 4); `POST /api/stripe/payments` at 19:07:17. The owner saw "refund failed" on both the customer and provider booking pages |
| Operator alert for the failed refund | Verified sent; delivery to a read inbox unverified | Resend shows "Action needed: a refund didn't reach the customer" sent once and **bounced**: Preview's `CEAUTE_OPERATOR_EMAIL` was `ops@ceaute.com`, which has no mailbox. The owner changed it to a mailbox they read and redeployed Preview |

Earlier the same day an early customer cancellation (`pi_3ULku7…`) refunded
£15 in full; see the
[30 September report](2026-09-30-preview-acceptance-drops-and-flat-deposit.md).
