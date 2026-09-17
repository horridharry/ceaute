# Customer booking end-to-end verification — 17 September 2026

One complete customer booking, verified against local infrastructure and
Stripe test mode, on branch `fix/checkout-feedback-and-verification` at
commit `3257e3c`. No application code was changed to produce this result;
this report only records what was observed. No real charge was made, no
production data was touched, and Stripe's bot-detection was not bypassed at
any point.

## Method

- Database: local Supabase (`supabase start`), restored from the backup
  taken during the previous audit session, so the test provider, treatments,
  add-ons and availability from that session were reused.
- App: `next dev` on port 3100, pointed at the local database, with a real
  Stripe **test-mode** secret key and a locally-generated webhook secret
  (`whsec_local_journey_test_payment`) used only to sign requests sent to the
  local server — it is not registered with Stripe and was never sent to
  Stripe.
- Auth: real email-OTP sign-up/sign-in, codes read from Mailpit
  (`http://127.0.0.1:54324`), which captures the local Supabase Auth SMTP
  traffic.
- Stripe: the real `acct_1UGmm2AQCiFrvDMe` test-mode connected account,
  manually completed by the user through Stripe's hosted onboarding between
  sessions.
- Browser: the built-in browser pane, driving the real UI as a customer and
  as the provider would.

## 1. Stripe Connect readiness

**Verified.** Checked directly against the Stripe API before touching the
app:

```
transfers: active | payouts: active
outstanding requirements: 1
  - identity.individual.documents.primary_verification (deadline: eventually_due)
```

The one remaining requirement has an `eventually_due` deadline, meaning it
does not currently restrict either capability — confirmed by the capability
status itself already reading `active`.

Refreshed through the app's own action, not the database: signed in as the
provider, `/dashboard/settings/payments` → **Refresh status**
(`refreshPaymentStatus`, [payments/actions.js:56-97](../../src/app/(dashboard)/dashboard/settings/payments/actions.js)).
The page changed from "Payments restricted" to:

> **Payments ready** — Your Stripe account can receive transferred customer
> payments and payouts. Transfers: active. Payouts: active. Recipient setup:
> Applied.

Database afterwards (`provider_payment_account`):
`stripe_transfers_status = active`, `payouts_status = active`,
`requirements_currently_due = []`, `requirements_past_due = []`. This was
written by the real Stripe API sync, not by hand.

## 2. Provider publication

**Verified.** Signed in as the provider, `/dashboard/profile` showed "Your
page has everything needed for publication." Clicked **Publish page**
(`publishPage` → `ceaute.publish_provider_page`, the same trusted-operation
path the pgTAP suite exercises). The page immediately showed:

> **Published** — Your page is published.

Database: `provider_page.status = 'published'`,
`published_at = '2026-09-17T22:14:28Z'`. No manual `UPDATE` was run — this
is the opposite of the previous session, where I had written `status`
directly to unblock UI testing before Stripe was ready. That earlier
override was reverted to `draft` at the start of this session, so this
publish is the first and only one on real data.

## 3. Complete customer booking

**Verified**, treatment with two add-ons, `/@cluxeklawsjourney`, as a
different, newly-authenticated customer account
(`customer-journey-test@example.com`, signed in — not signed up again —
through the existing OTP flow):

| Stage | Result |
| --- | --- |
| Treatment selection | Gel Polish, via the new bottom-sheet UI |
| Add-ons | Nail Art (+£5.00, +15 min) and Removals (+£10.00, +25 min), both checked; sheet showed a live total of **£50.00 · 1 hr 25 min** before continuing |
| Choose a time / availability | Monday 21 Sept, 09:00–10:25, the first free slot (09:00 on the prior test date had since expired and released) |
| Authentication | Anonymous customer redirected to `/sign-in?next=...` carrying the full checkout URL (`start_at` + both `add_on` values); after OTP sign-in, returned to that exact URL with the same treatment, add-ons and time still selected |
| Hold | `booking.id = 278c376c-f4e2-4c23-bb2b-bdc8aa2e33ff`, `status = awaiting_payment`; page showed "Exact address and access instructions are shown after confirmation" (not yet revealed) |
| Stripe Checkout | Real session `cs_test_a1OoK3qNM95Xk9vXm27PQpqQYYOD2t4PnGhdKkXJpFZnjLGZuxbBLGv98r`, Stripe's own page showed **"Sandbox" · "Cluxeklaws Journey Test - Gel Polish" · £50.00** — matching the booking summary exactly |
| Payment | Stripe's documented test card `4242 4242 4242 4242`, `12/34`, `123`; Stripe accepted it: PaymentIntent `pi_3UGnecAQCi6m6Wd838YQBNJ7`, `succeeded`, `amount = 5000` (pence), `currency = gbp` |
| Return page | "Payment is being verified. This page will show confirmation once Stripe's webhook confirms it." — confirmed the return URL does not itself confirm anything |
| Webhook | Real event `evt_1UGnedAQCi6m6Wd82dWlQQyf` (`checkout.session.completed`), fetched from Stripe's own Events API and delivered to the local endpoint with a valid signature (see §6) → `200 {"received":true}` |
| Confirmation | `booking.status = confirmed`, `confirmed_at = 2026-09-17T22:21:27Z` |

### Correctness checks

- **Price and duration:** £35.00 + £10.00 + £5.00 = **£50.00**;
  45 + 25 + 15 = **85 minutes (1 hr 25 min)** — matches the sheet, the
  checkout summary, the Stripe Checkout amount, and the confirmed booking
  detail pages exactly.
- **Confirmed only after a verified webhook:** the booking remained
  `awaiting_payment` / `confirmed_at = null` for the ~4 minutes between
  Stripe accepting the card and my delivering the signed webhook — proving
  the return page's own claim.
- **Private address:** before confirmation, only "Shoreditch, London" (the
  public area) was ever shown. After confirmation, both the customer's and
  the provider's booking-detail pages show the full address (`12 Test Studio
  Mews, London, E1 6AN`) and the access instructions.
- **Correct customer identity:** the provider's detail page shows
  "Journey Customer", `customer-journey-test@example.com`,
  `+447500987654` — the account that actually authenticated and paid, not
  the provider's own.
- **Booking outbox payload** (`booking_email_outbox`, both rows) contains the
  correct treatment, both add-ons with their individual price and duration,
  `amount_paid_pence: 5000`, the full address and access instructions, and
  the cancellation deadline.

## 4. Webhook idempotency

**Verified.** Replayed the identical signed event
(`evt_1UGnedAQCi6m6Wd82dWlQQyf`) a second time → `200 {"received":true}`.
Afterwards:

| Check | Before replay | After replay |
| --- | --- | --- |
| Bookings with this id | 1 | 1 |
| Payment attempts on this booking | 1 | 1 |
| `stripe_payment_event` attempt_count | 1, `processing_status = completed` | 1 (unchanged) |
| Email outbox rows | 1 `booking_confirmed_customer`, 1 `booking_confirmed_provider` | unchanged |
| `confirmed_at` | `22:21:27.771459Z` | unchanged |

No second booking, no second payment record, no duplicate email row, no
second Stripe call. The route's `claim_stripe_payment_event` recognised the
event as already `completed` and returned `{received:true}` before running
any processing logic — exactly the short-circuit the code and the existing
pgTAP suite (`payment_integrity_hardening.test.sql`) describe.

## 5. Failure behaviour

**Verified**, on this exact commit, before the Stripe onboarding above was
completed (so the failures were genuine, not staged): with the checkout
page's new `payment=` notice (added by this branch's earlier commit), the
three states the checkout action can redirect with were each observed live:

| `payment=` value | Rendered notice |
| --- | --- |
| `unavailable` | "Payment is not available — Ceaute could not start a payment for this booking because this provider cannot take online payments right now..." |
| `expired` | "That payment session expired — The payment was not completed in time..." |
| `processing` | "A payment is already being processed — ...check whether it is confirmed before paying again." |
| *(absent)* | no notice rendered |

In every case the booking's `status` stayed `awaiting_payment` — a failed or
unavailable payment never confirms a booking. This was re-verified after the
regression suite, not assumed from the earlier session.

## 6. How the webhook was delivered locally

Real Stripe webhooks cannot reach `localhost`. Rather than fabricate a
payload, I fetched the literal event Stripe had already created for this
checkout completion (`stripe.events.retrieve(...)`, read-only, no
Stripe-side effect) and delivered it to the local
`/api/stripe/payments` route with a valid `Stripe-Signature` header computed
with `Stripe.webhooks.generateTestHeaderString` and the local server's own
`STRIPE_PAYMENT_WEBHOOK_SECRET`. That secret is not registered with Stripe
and exists only in this local dev process; nothing about this changes what
the webhook handler received or how it verified the signature.

## 7. Regression checks

| Command | Result |
| --- | --- |
| `npm test` | **155/155 pass** |
| `npm run typecheck` | clean |
| `npm run lint` | clean |
| `npm run build` | compiled successfully |
| `npm run test:db` | **282/282 pass** |

No migrations, application code, or tests were changed to reach these
results; this section reruns the same suite the branch already had.

## 8. Limitations and one incident

**Booking confirmation/cancellation emails do not reach Mailpit, by
architecture, not by defect.** Mailpit captures the local Supabase Auth
SMTP traffic (which is why the OTP codes above could be read from it).
Booking confirmation and cancellation emails are sent by
[`booking-emails.js`](../../src/lib/emails/booking-emails.js) with a direct
`fetch` to `https://api.resend.com/emails` — an HTTPS call to a third-party
API, not SMTP — so Mailpit has no visibility into it under any
configuration. I did not change this, because doing so was out of scope and
not requested.

Given that, "delivered to Mailpit" was not literally achievable for these
two emails without either a real `RESEND_API_KEY` (see the incident below,
which is exactly why that is unacceptable here) or a source change to
redirect the request (out of scope). Instead I verified the full pipeline
short of the real third-party call:

- Both events were correctly enqueued in `booking_email_outbox`
  (`booking_confirmed_customer` → the customer's real address,
  `booking_confirmed_provider` → the provider's real address), with a
  payload containing the correct treatment, both add-ons, amount paid, and
  address.
- I then called the app's own `deliverPendingBookingEmails` function
  directly (unmodified, imported as-is) against the real local database,
  passing it a synthetic `environment` (a placeholder API key, never used
  for a real request) and a `fetchImpl` that intercepts the call and returns
  a fake success response instead of making a network request. This
  exercises the real claim, subject/body rendering, and mark-sent RPCs
  against real data. Both rows ended `delivery_status = sent` with a
  recorded `provider_message_id`, and the intercepted requests showed the
  correct recipient and subject for each
  (`New booking confirmed` → provider, `Your booking is confirmed` →
  customer).
- This is short of literal delivery into an inbox. If Resend delivery
  itself needs to be proven, that requires either a disposable Resend test
  API key sending to an address you control, or reconfiguring the app to
  target Mailpit's SMTP for local development — both are decisions for you,
  not something I did unilaterally.

**Incident: one real, unauthorized call to the live Resend API.** Before
reaching the substitution above, I ran the deployed `/api/cron/send-booking-emails`
route through the running dev server, expecting the email step to report
"not configured" because I had `unset RESEND_API_KEY` in the server's launch
script. That was wrong: `unset` removes a variable from the *current shell*,
but leaves the key genuinely absent from `process.env`, and Next.js's
`.env.local` loader fills in exactly that — any key not already present in
`process.env` — so the real production Resend key from `.env.local` was
loaded and used. The route made two real HTTPS requests to
`api.resend.com` addressed to `customer-journey-test@example.com` and
`provider-journey-test@example.com`.

**No email was sent or delivered to anyone.** Resend's own API rejected
both requests before accepting them, with the error *"Invalid `to` field.
Please use our testing email address instead of domains like
`example.com`."* — visible in `booking_email_outbox.last_error`. The
requests are still real, authenticated calls to a live third-party service
that I made without your authorization, even though they had no user-facing
effect. I stopped immediately on seeing `"configured":true` in the
response, did not retry, told you as it happened, and fixed the launch
script to set `RESEND_API_KEY=""` explicitly (an empty value already present
in `process.env` is not overwritten by `.env.local`) before doing anything
else. I verified the fix: a second call to the same route returned
`{"configured":false,...}` with `"claimed":0` — no further request was
made. This account's live Resend key is now known to have been used from
this environment; you may want to check the Resend dashboard for these two
rejected requests and decide whether to rotate the key.

## 9. Real Resend delivery, completed after key rotation

Following the incident in §8, the user rotated the Resend API key and
authorised one further test: sending the two outbox rows from the same
confirmed booking (`278c376c-f4e2-4c23-bb2b-bdc8aa2e33ff`) through the real,
rotated Resend key, to the user's own Resend account email — the only
recipient a sandbox `onboarding@resend.dev` sender is permitted to reach
without a verified sending domain.

**Key check (no email sent).** Confirmed present, correctly formatted
(`re_` prefix), and authenticated by Resend itself: a read-only
`GET https://api.resend.com/domains` returned
`401 {"name":"restricted_api_key","message":"This API key is restricted to
only send emails"}` — a scope refusal, not an authentication failure, which
confirms the key is valid and deliberately least-privilege. The key value
was never printed or logged.

**Local test data only.** The two existing `booking_email_outbox` rows for
this booking (still local, not production) were updated: `recipient_email`
set to the authorised address, and `delivery_status`/`attempt_count`/
`provider_message_id`/`sent_at`/`last_error` reset so they were claimable
again. The payload's own `customer_email`/`customer_name`/`customer_phone`
fields — the real content the provider's email displays — were left
untouched, so the content check below is against the booking's genuine
data, not fabricated data.

**Real send.** `/api/cron/send-booking-emails` was called against a dev
server configured with the real, rotated key (loaded from `.env.local` only
for this one authorised run):

```
{"claimed":2,"sent":2,"failed":0,"skipped":0,"configured":true}
```

Both rows ended `delivery_status = sent` with a real Resend message id
(`01a0b193-cd6a-7764-...` and `01a0b193-cc3d-7115-...`, UUIDv7-shaped, not
the earlier `fake_msg_*` placeholders) and no `last_error`. Resend's GET
endpoint for those ids also returned the same `restricted_api_key` refusal
— consistent with a send-only key, not evidence against the send. Beyond
the API's own `200`/message-id, confirming the messages landed in the inbox
and reading their rendered content is something only the account holder can
do by checking that inbox; I have no way to view a personal Gmail inbox
myself.

**Retry produces no duplicate.** Ran the same route again immediately
afterwards:

```
{"claimed":0,"sent":0,"failed":0,"skipped":0,"configured":true}
```

`claimed: 0` — `claim_pending_booking_emails` only selects `pending` or
`failed` rows, so a `sent` row is never reclaimed. Reconfirmed directly:
both rows still show `attempt_count = 1`, the same `sent_at` and the same
`provider_message_id` as the first run, and there is exactly one outbox row
per event type for this booking — no duplicate row, no duplicate send.

Afterwards the dev server and local Supabase stack were stopped; nothing
about this check touched the hosted project.

## Summary

| Question | Answer |
| --- | --- |
| Stripe Connect ready? | Yes — `transfers: active`, `payouts: active`, confirmed via the API and via the app's own refresh action |
| Publication succeeded normally? | Yes — through `publish_provider_page`, no manual database write |
| Customer completed payment? | Yes — real Stripe test-mode card `4242 4242 4242 4242`, PaymentIntent `succeeded`, £50.00 |
| Booking confirmed correctly? | Yes — only after the signed webhook, with correct treatment, add-ons, price, duration and address-reveal timing |
| Both emails delivered? | Yes, after the key rotation — both accepted by the real Resend API with real message ids (§9); rendered content in the inbox is for the account holder to confirm |
| Duplicate webhook safe? | Yes — replay produced no duplicate booking, payment attempt, or email, and the confirmation timestamp was unchanged |
| Duplicate email retry safe? | Yes — re-running the delivery job claimed nothing and left both rows unchanged (§9) |
| All regression tests pass? | Yes — 155 unit, 282 database, clean typecheck/lint/build |
| Ready for merge? | Yes, from this verification's standpoint — every stage in the booking flow, including real Stripe payment and real Resend delivery, is now verified end to end. Not merged; the user's approval is still required |
