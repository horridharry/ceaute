# Booking and refund email failure: forensic investigation, 23 September 2026

Revision 2. This revision adds evidence read in the signed-in browser from the
Vercel dashboard, the Resend dashboard, the Supabase dashboard and the Stripe
test Workbench.

This was a read-only audit of:

- `ceaute-dev` (`fgnusdbpuvndilryvudc`)
- the Stripe test sandbox "Ceaute Dev"
- the Vercel project `ceaute`
- Resend
- the repository

Nothing was changed. No job was invoked, no email was sent and no webhook was
resent. All times are UTC unless marked BST; both the Vercel and Resend
dashboards display BST. Record IDs are truncated to 8 characters, and Stripe
IDs are shown by their last characters only. Recipients, email bodies and
secret values are not reproduced here.

**Sources used:**

- `supabase db query --linked` (SELECT only)
- Stripe CLI (list and read)
- Vercel: Environment Variables, Deployment Protection, Activity and Logs
- Resend: Emails, API keys and Logs
- Supabase: Vault and org Audit Logs (Audit Logs are unavailable on the Free
  plan)
- Stripe Workbench: event deliveries

**Status when committed (2026-09-23, later the same evening).** The findings
below are unchanged; the repair has since started on ceaute-dev only:

1. Migration `202609230006` added a `cancelled` outbox state, and the 10
   stale rows were set to `cancelled`, so none of them will be sent.
2. Vault now holds `ceaute_cron_base_url = https://preview.ceaute.com` and a
   `ceaute_cron_protection_bypass`, and migration `202609230007` sends it as
   `x-vercel-protection-bypass`.
3. The first natural tick after that (20:30 UTC) reached `preview.ceaute.com`
   and was authenticated: `send-booking-emails` answered
   `200 {"claimed":0,…,"configured":true}` and `recover-booking-refunds`
   answered `200 {"listed":0,…}`. Preview's `CRON_SECRET` therefore already
   matched Vault; no rotation was needed.

Still open: real delivery of a new email through Resend on Preview, the first
`complete-bookings` run through the fixed path, the ceaute-prod lead in §5.3,
and the Stripe `checkout.session.expired` 500s in §10. The ceaute.com fallback
(§7.6) has not been removed.

---

## 1. Summary

| | Booking confirmation | Refund / cancellation emails |
| --- | --- | --- |
| Queued in the outbox? | Yes: 8 rows, 4 bookings, customer and provider | Yes: 2 `provider_cancelled` rows, 1 booking |
| Claimed by the sender? | **No** (`attempt_count 0`, `claimed_at` null) | **No** |
| Resend called? | **No.** Resend's log shows **no application (Node.js) request from any environment after 2026-09-18 19:27:12** | **No** |
| Root cause | ceaute-dev's scheduler calls **https://ceaute.com (Production)**, which answers 401 | Same |
| Confidence | **High**, corroborated from both ends: pg_net on dev and the Vercel request log | **High** |
| Last provable success (ceaute-dev scheduler path) | **2026-09-17 18:40:01**: Resend `01a0b0ab…`, confirmation pair, delivered | **2026-09-17 18:50:01**: Resend `01a0b0b4…`, `customer_cancelled` pair, delivered |
| Last booking email of any kind | 2026-09-18 19:27:12, not sent by the scheduler (see §5.3) | 2026-09-17 18:50:01 |
| Earliest provable failure | **2026-09-20 14:40:00**: send run 1209 leaves `ebf6500d` unclaimed | **2026-09-23 14:10:00**: pg_net response 2140 is a `401` |
| Earliest likely failure (not directly logged) | After 2026-09-18 about 11:50 | **2026-09-18 18:01:51 and 18:31:31**: two test cancellations were refunded by Stripe, and no cancellation email exists in Resend |
| Defect introduced | **2026-09-18, about 11:40–11:50**, during the Production/Development separation. Medium-high confidence: the window is bounded by the evidence, but the switch itself has no surviving log | Same |
| Recoverable? | Yes | Yes |

---

## 2. How an email is supposed to travel

1. **The event.** A booking moves to `confirmed` (with `confirmed_at` set), or
   moves from `confirmed` to `cancelled` by the customer or the provider. The
   deferred trigger `booking_enqueue_transactional_emails` then calls
   `enqueue_booking_transactional_emails`
   (`supabase/migrations/202609130004_make_booking_email_delivery_recoverable.sql:98-125`).
   Late-payment refunds are queued when a `booking_refund_operation` row with
   `purpose = 'late_payment'` is inserted
   (`202609230004_late_payment_refund_email.sql:34-83`).
2. **The outbox.** A `pending` row is written to `ceaute.booking_email_outbox`.
3. **The scheduler.** pg_cron runs `ceaute-send-booking-emails` every
   10 minutes, which calls `ceaute.invoke_cron_endpoint`. That function sends a
   GET to `coalesce(vault 'ceaute_cron_base_url', 'https://ceaute.com')` with
   the header `Authorization: Bearer <vault 'ceaute_cron_secret'>`
   (`202609150001_schedule_cron_endpoints_with_supabase_cron.sql:22-63`).
4. **The route.** `src/app/api/cron/send-booking-emails/route.ts:5-10` answers
   `401 {"error":"Unauthorized."}` unless the bearer matches that deployment's
   `CRON_SECRET`.
5. **Delivery.** `deliverPendingBookingEmails`
   (`src/lib/emails/booking-emails.js:42-131`) checks the configuration,
   claims rows, sends each one to `api.resend.com/emails` with
   `Idempotency-Key` set to the outbox id, and records `sent` or a retryable
   failure.

Pg_cron reports "succeeded" as soon as pg_net has queued the request. It says
nothing about the HTTP result.

---

## 3. Booking confirmation: trace

| Booking | Confirmed | Payment | Stripe webhook | Outbox (created) | Status |
| --- | --- | --- | --- | --- | --- |
| `9b198cf6` | 09-20 14:33 | `succeeded` £45.00 | processed | `ebf6500d`, `4e76b108` (14:33:19) | pending, 0 attempts |
| `c2a78221` | 09-20 16:23 | `succeeded` £45.00 | processed | `d93743e3`, `9f4ffd9e` (16:23:11) | pending, 0 attempts |
| `4f3a369f` | 09-21 23:28 | now `refunded` | processed | `7b21eb56`, `a1734c14` (23:28:42) | pending, 0 attempts |
| `ce72ffc6` | 09-23 05:03 | `succeeded` £14.20 | processed (`evt …gV181x7N`) | `fa8255ae`, `7d83c598` (05:03:29) | pending, 0 attempts |

`d0e29f92` is an expired hold: it never confirmed and was correctly never
queued.

1. **The event occurred.** Stripe shows `pending_webhooks = 0` for each
   `checkout.session.completed`.
2. **The state was reached.** All four bookings were confirmed and paid.
3. **The outbox rows were created**, within one second of the webhook. None has
   any status history: `updated_at` equals `created_at` on every row.
4. **The scheduler ran but never claimed anything.** There were 144 send runs
   a day, and run 1209 at **09-20 14:40:00** was the first tick after the first
   row was queued.
5. **Resend was not called.** Resend → Logs, filtered to the Node.js user agent
   (the application's `fetch`), shows **no request of any kind after
   2026-09-18 19:27:12 (log `ead2fac7`)**. Every outbox row was created on or
   after 09-20.
6. **Resend recorded no outcome** for these rows: nothing was accepted,
   delivered, bounced or rejected.

## 4. Refund emails: trace by type

| Type | Trigger | Occurred on ceaute-dev? | Result |
| --- | --- | --- | --- |
| `provider_cancelled_customer` / `_provider` | `confirmed → cancelled` by the provider | **Yes**, `4f3a369f` | Queued, never claimed |
| `customer_cancelled_customer` / `_provider` | `confirmed → cancelled` by the customer | Not in the current (post-reset) data | Not due now. The last delivered pair was 09-17 18:50:01 |
| `late_payment_refunded_customer` | insert of a `late_payment` refund operation | No such operation exists | Never due. The trigger is installed and enabled. No such email exists in Resend |

In the 15-day Resend window, a search for "cancelled" finds only
`customer_cancelled` subjects, all dated 09-16 to 09-17. A search for "refund"
finds nothing. **No `provider_cancelled` and no late-payment email has ever
been delivered.**

**Timeline for `provider_cancelled`, booking `4f3a369f`:**

- **09-23 14:06:23**: the booking is cancelled by the provider. Refund
  operation `49abd1f3` (£45.00) is created, and outbox rows `ea644f58` and
  `c29d582c` are queued.
- **14:06:23–26**: Stripe refund `re_…OTmtd2` succeeds. The refund events show
  `pending_webhooks = 0`.
- **14:06:27**: Ceaute records `refund.updated` as completed. The payment
  attempt becomes `refunded`.
- **14:10:00**: pg_net response **2140** is `401 {"error":"Unauthorized."}`
  (`x-matched-path: /api/cron/send-booking-emails`, Vercel `dub1`). The rows
  are still pending, and Resend was not called.

**The 18 September test refunds.** Stripe refunds `re_…M6R8Ct` (09-18 18:01:51,
booking `63ca0f17`) and `re_…h6dFgm` (09-18 18:31:31, booking `76fe48f2`) both
carry `purpose = cancellation`. **Resend has no cancellation email for
either.** Neither booking exists in ceaute-dev today. See §5.3.

---

## 5. Root cause

### 5.1 The scheduler targets Production (proven)

- **ceaute-dev's Vault** holds `ceaute_cron_secret` (created 09-15 21:41,
  updated 09-18 23:55:47) and has **no `ceaute_cron_base_url`**. Its requests
  therefore go to the hard-coded default, `https://ceaute.com`.
- **pg_net on ceaute-dev** has retained 78 responses (09-23 11:10 to 17:00),
  and all 78 are the application's own `401`. They are JSON, served by Vercel,
  with a matched route path. This is not Vercel's SSO response.
- **The Vercel request log, viewed from the receiving end**, filtered to
  `/api/cron`. On every tick, `ceaute.com` receives **two sets of calls**: a
  200 from ceaute-prod's scheduler and a **401** from ceaute-dev's. For
  example, at 23 Sept 18:10:00 BST (17:10 UTC):
  - `send-booking-emails` returned 200 at .38 and 401 at .78.
  - `recover-booking-refunds` returned 200 at .37 and 401 at .78.
  - At 18:00:00 BST, `complete-bookings` also received a 200 and a 401.
- **No `/api/cron` request reached `preview.ceaute.com`** in the retained log
  window.
- **The same fault breaks the other jobs.** Bookings `9b198cf6` and `c2a78221`
  are still `confirmed` although their appointments were on 09-21 and 09-22.

Even an authenticated call to ceaute.com would process **ceaute-prod's**
outbox, not dev's. Changing the secret alone cannot fix this.

### 5.2 When it was introduced

| Time (UTC) | Evidence | Meaning |
| --- | --- | --- |
| 09-15 20:36 (commit) / 21:41 (Vault) | `ba772bc` moved scheduling from Vercel Cron to Supabase Cron, defaulting to ceaute.com. ceaute.com used ceaute-dev at that time | Correct at the time |
| 09-17 | pg_net recorded 41 × 200 (`2026-09-17-email-otp-and-refund-recovery.md` §3) | The scheduler path works |
| **09-17 18:40:01 and 18:50:01** | Resend `01a0b0ab…` and `01a0b0b4…`: confirmation and cancellation pairs, sent exactly on the 10-minute grid, key `ceaute-dev`, delivered | **Last provable scheduler-driven successes** |
| 09-17 22:54:08 | A confirmation pair sent off the grid | A manual run, not the scheduler |
| **09-18 about 11:40–11:50** | Stage 1 moved ceaute.com to ceaute-prod and **rotated Production's `CRON_SECRET`**. Vercel Activity shows Production redeploys via the Vercel CLI on 18 Sept. Dev received no `ceaute_cron_base_url` | **Defect introduced** |
| 09-18 (date only) | Vercel Protection Bypass for Automation created | Tooling for Preview became available |
| 09-18 18:01:51 and 18:31:31 | Two cancellation refunds with no cancellation email | Consistent with the failure; see §5.3 |
| 09-18 19:27:12 | The last application call to Resend from any environment (see §5.3) | |
| 09-18 23:55:47 | Dev Vault `ceaute_cron_secret` updated. Preview `CRON_SECRET` shows "Updated Sep 19", and 00:55 BST on 19 Sept is the same moment | Very likely rotated to match Preview. That cannot help while the base URL is ceaute.com |
| 09-18 (date only) | Resend keys `ceaute-production` and `ceaute-development` created. The old key `ceaute-dev` is now **Deleted** | Key rotation |
| 09-20 | ceaute-dev data reset; `preview.ceaute.com` domain added; Preview `CEAUTE_APP_URL` updated | |
| 09-20 14:40 | First tick that provably left a row unclaimed | Earliest provable failure (confirmation) |
| 09-23 14:10 | 401 retained in pg_net | Earliest directly logged failure (refund) |

The exact tick at which dev's scheduler went from 200 to 401 is not logged
anywhere that survives. pg_net keeps about 6 hours, and the Vercel log window
on this plan is under an hour. Supabase audit logs are not available on the
Free plan. The introduction time is therefore bounded by two events: the
successes at 09-17 18:50 and the Production secret rotation at about 11:40 on
09-18.

### 5.3 The 18 September emails that do not fit the scheduler (lead, outside test scope)

- Resend `01a0b5db…`: "New booking confirmed", 09-18 **18:51:25**, key
  `ceaute-dev`, older HTML template.
- Resend `01a0b5fc…`: "Your booking is confirmed", 09-18 **19:27:12**, key
  `ceaute-dev`, current template. Its "View booking" link points to
  **ceaute.com**, for booking **`76fe48f2`**. That booking's cancellation
  refund had **already succeeded at 18:31:31**.
- Neither email falls on either project's 10-minute grid, so they came from a
  manual or unscheduled run. The ceaute.com link host means the sender had
  `CEAUTE_APP_URL = https://ceaute.com`. Local runs use
  `http://localhost:3000`, so this was most likely **Production**, which had
  used ceaute-prod since about 11:50 that day.
- So a booking that was probably tested on ceaute-prod received a confirmation
  56 minutes **after** it was cancelled, and never received a cancellation
  email. That may be a **separate Production-side email problem**. It was not
  investigated, because ceaute-prod is outside this test-only audit.

### 5.4 Configuration now in place for Preview (read from Vercel, values not revealed)

| Item | State |
| --- | --- |
| Preview `CRON_SECRET` | Present, Secret type, updated Sep 19 |
| Preview `RESEND_API_KEY` | Present, updated Sep 19 |
| Preview `CEAUTE_EMAIL_FROM` | Present, updated Sep 19 |
| Preview `CEAUTE_APP_URL` | Present, updated Sep 20 |
| Protection Bypass for Automation | **Exists**, added Sep 18 |
| Is the bypass proven to work? | **Yes.** The Stripe test webhook endpoint (`…orBwQ7`) already reaches `https://preview.ceaute.com/api/stripe/payments` with the bypass as a query parameter, and payment and refund events are processed |
| Resend API keys | `ceaute-production` (last used about 1 day ago) and `ceaute-development` (last used about 20 minutes ago, matching dev Auth OTP mail). The key that sent every earlier booking email, `ceaute-dev`, is **deleted**. The local `.env.local` key matches the `ceaute-development` prefix. **Which key Preview holds cannot be read** |

### 5.5 Remaining blockers once the scheduler targets Preview

1. `invoke_cron_endpoint` cannot send `x-vercel-protection-bypass`. The query
   parameter used by the Stripe endpoint cannot be used here either, because
   the path is appended after the base URL.
2. It is unproven that the Preview `CRON_SECRET` equals dev's Vault value. The
   timing suggests they match.
3. If Preview's `RESEND_API_KEY` is the deleted `ceaute-dev` key, the first
   run will get a Resend authentication error. The rows would go to `failed`
   and retry with backoff, up to 10 attempts.

---

## 6. Are the queued messages recoverable?

**Yes.** All 10 rows are `pending`, with 0 of 10 attempts used and
`next_retry_at` in the past. Resend has never seen these idempotency keys, so
there is no duplicate risk.

**The user needs to decide what happens to the backlog before sending is
enabled.** The rows go to real `gmail.com` recipients and would all send in the
first run, oldest first:

- 4 confirmations for appointments that have already passed (`9b198cf6`,
  `c2a78221`);
- 2 confirmations for the cancelled booking `4f3a369f`, immediately followed by
  its two cancellation emails;
- both cancellation payloads froze `refund_status = 'refund_required'`, so they
  will read **"Refund pending"** although Stripe completed the refund 3 seconds
  later. This is a design issue: cancellation emails are queued before the
  refund settles.

The options are:

1. send all 10;
2. have the implementation chat propose a data-only step that marks the stale
   rows so they are never sent;
3. reset ceaute-dev test data.

Any of these is outside this audit.

---

## 7. Minimal proposed fix (not implemented)

**The user's part:**

1. Create a **separate** Protection Bypass for Automation secret for the cron
   jobs (Vercel accepts several), so the one embedded in the Stripe endpoint
   URL is not reused.
2. Rotate the Preview `CRON_SECRET` and ceaute-dev's Vault
   `ceaute_cron_secret` to the same new value. Compare SHA-256 digests; never
   print the value.
3. In ceaute-dev's Vault, add `ceaute_cron_base_url =
   https://preview.ceaute.com` and `ceaute_cron_protection_bypass =
   <the new bypass value>`.
4. Confirm that Preview's `RESEND_API_KEY` is the `ceaute-development` key. It
   is safest to re-set it and redeploy Preview. Confirm that
   `CEAUTE_EMAIL_FROM` is on `ceaute.com` and that `CEAUTE_APP_URL` is
   `https://preview.ceaute.com`.

**The implementation chat's part:**

5. Write a migration that replaces `ceaute.invoke_cron_endpoint` so it adds
   `x-vercel-protection-bypass` when the Vault secret
   `ceaute_cron_protection_bypass` exists, and behaves exactly as today when it
   is absent. Add pgTAP cases to the existing cron-schedule tests.
6. Recommended: stop defaulting to ceaute.com. Require `ceaute_cron_base_url`
   and skip with a notice when it is missing, after setting it explicitly on
   ceaute-prod first. This changes Production behaviour, so it needs approval
   and an ordered rollout. The silent default is what hid this failure for five
   days.
7. Optional: return non-200 from the send route when email is not configured,
   so `claimed:0` cannot mask a misconfiguration.

## 8. Verification procedure (after the fix, with the user's approval)

1. Apply the migration to ceaute-dev, then run
   `supabase migration list --linked`. Expect 68/68.
2. On the next natural tick, without invoking anything:
   - **Vercel Logs** (`/api/cron`) should show a `200` from
     **`preview.ceaute.com`** and no new 401s on ceaute.com.
   - **pg_net** (`net._http_response`) should show `200` with
     `configured:true`.
   - A `401` means the secret does not match. A `302` or an HTML body means the
     bypass header is missing.
3. **Outbox:** the rows should become `sent` with a `provider_message_id`. A
   `failed` row with a Resend `last_error` points to the API key or the sender
   domain.
4. **Resend → Logs (Node.js):** the new `POST /emails` requests should show
   `200` from key `ceaute-development`. **Resend → Emails** should show them
   as Delivered, not Bounced or Suppressed. Then confirm receipt in the
   approved inbox.
5. **Idempotency:** the next tick should claim 0 rows.
6. **End-to-end test on Preview** with Stripe test card 4242:
   - A new booking should produce a confirmation within 10 minutes.
   - A provider cancellation should produce a cancellation email, and the
     Stripe refund should reach `succeeded`.
   - A late-payment refund email remains unverified until one is deliberately
     produced.
7. After the next hourly run, `9b198cf6` and `c2a78221` should move to
   `completed`.

---

## 9. Unknowns

| Unknown | What would resolve it |
| --- | --- |
| The exact tick when dev's scheduler went from 200 to 401 | Not recoverable. pg_net keeps about 6 hours, the Vercel log window on this plan is under an hour, and Supabase audit logs need the Team plan |
| Which Resend key Preview's `RESEND_API_KEY` holds | Vercel Secret values cannot be read. Re-set the variable (§7.4), or watch the key name in Resend Logs on the first send |
| Whether Preview `CRON_SECRET` equals the dev Vault secret | Rotate both (§7.2) |
| Who changed the dev Vault secret on 09-18 at 23:55, and why | The owner's recollection. Supabase org audit logs are not available on Free |
| The source of the off-grid emails at 09-18 18:51 and 19:27, and the missing cancellation emails for `63ca0f17` and `76fe48f2` | A read-only query of ceaute-prod's outbox and bookings. It was deliberately **not** done, because it is outside the test-only scope and needs your approval |
| When the Resend key `ceaute-dev` was deleted | Resend does not show a deletion date. The owner's recollection |

## 10. Unrelated defects observed (not investigated further)

- **Stripe → Preview payments webhook returns 500 for `checkout.session.expired`.**
  - Event `evt_…S6xxtVCM` (Checkout Session created 09-23 04:14) was delivered
    at 04:14, 05:13 and 07:13. Each attempt got `500 {"error":"Could not
    process Stripe payment event."}`. `evt_…b6fGgUZa` is also pending.
  - The expired session is not in ceaute-dev (0 matching payment attempts).
    That suggests it was created by the isolated local acceptance stack against
    the shared Stripe sandbox. Stripe will keep retrying for up to 3 days.
  - Nothing was resent. This deserves its own look: an unknown session should
    probably be acknowledged, not answered with a 500.
- **The Stripe sandbox shows a "Multiple capabilities paused" banner.**
- **The Vercel bypass secret is embedded in the Stripe webhook URL.** It is
  visible to anyone with Stripe dashboard access. This is acceptable under
  Vercel's documented query-parameter method, but it is a reason to use a
  separate bypass secret for cron (§7.1).
