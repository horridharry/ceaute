# Email codes and refund recovery: findings, 17 September 2026

Evidence gathered read-only from the hosted `ceaute-dev` Supabase project
(`supabase migration list --linked`, `supabase db query --linked`) and the
deployed site on 17 September 2026. Nothing hosted was changed. Email
addresses were aggregated by domain and no secret was read.

## 1. Why magic links failed

### Confirmed

1. **The app used Supabase's PKCE link flow.** `@supabase/ssr` defaults to
   PKCE, and `auth.flow_state` holds a row per request. A PKCE link only
   signs someone in when `/auth/confirm` runs in the browser that holds the
   code-verifier cookie set when the email was requested.
2. **The iCloud signup's token was accepted by Supabase, but no session was
   ever created.** For the one `icloud.com` account, requested at 10:42:56 UTC:
   the link was verified at 10:44:17 (81 seconds later;
   `auth_code_issued_at` and `email_confirmed_at` are set), yet the account has
   `last_sign_in_at = null` and zero sessions. The one-time token was spent at
   Supabase's `/verify` endpoint and the PKCE code was never exchanged. Every
   later click on that email is a `403 One-time token not found`. An earlier,
   since-deleted account shows the same shape on 15 September (verified after
   15 seconds, never signed in).
3. **The retries made it worse.** The same person then requested two magic
   links 10 seconds apart (10:44:47 and 10:44:58); neither was ever verified.
   Supabase keeps one token per user, so the second request invalidated the
   first email, which is a second source of `One-time token not found` when
   the older email is opened. Three emails in two minutes also explains the
   `429 email rate limit exceeded`.
4. **The screens encouraged those retries.** Every Supabase failure, including
   the 429, produced "We could not sign you in. Check the email or create an
   account", there was no resend cooldown, and the form could be resubmitted
   immediately.
5. **Gmail is unaffected in the data.** The `gmail.com` account is confirmed
   and has signed in.

### Hypotheses, not proven

- *What spent the iCloud token.* Either the link was opened in a different
  browser context from the one that requested it (an iPhone opens Mail links
  in the default browser or an in-app view, which has no code-verifier
  cookie), or something fetched the link before the person did (a mail
  security scanner or link preview). The 81- and 15-second gaps look more
  like a person than a scanner, but the database cannot tell them apart and
  the Auth request logs were not available to this investigation.
- *Whether the hosted template uses `{{ .ConfirmationURL }}`.* The hosted
  email templates and SMTP settings are only visible in the Dashboard. The
  observed behaviour (token spent at Supabase before reaching Ceaute) is what
  the default `ConfirmationURL` template produces.

Both hypotheses lead to the same fix, because both are properties of putting
a single-use GET link in an email.

### Fix

A six-digit code the person types into the page that asked for it. Nothing
in the email can be fetched, the session is created in the requesting
browser by `verifyOtp`, and PKCE's cross-browser constraint no longer applies.
The screens now also stop the retry spiral: a 60-second resend cooldown, one
pending flag for both buttons, a repeated request for the same email inside
the cooldown returns to the code screen without asking Supabase again, rate
limits have their own message, and nothing claims an email was sent unless
Supabase accepted the request. Email rate limits were not raised.

Supabase returns the same `403 otp_expired` for a wrong, an expired and an
already-used code, deliberately. The screen therefore explains all three in
one message rather than guessing.

`verifyOtp` uses type `email` for both flows. It is Supabase's current type
for a code requested through `signInWithOtp`: it confirms a new account's
first code and signs in a returning user. The older `signup` and `magiclink`
types are deprecated aliases of those two cases.

## 2. Required Supabase Dashboard configuration

Application code does not change hosted templates. Until these steps are
done the hosted project keeps sending a link, and the new code screen cannot
be completed. Do them at the same time as the deploy.

1. **Authentication > Emails > Confirm signup.** Subject
   `Your Ceaute verification code`. Replace the whole body with
   `supabase/templates/confirmation.html`.
2. **Authentication > Emails > Magic Link.** Subject
   `Your Ceaute sign-in code`. Replace the whole body with
   `supabase/templates/magic_link.html`.
3. In both, check that `{{ .Token }}` is present and that
   `{{ .ConfirmationURL }}` appears nowhere, not even in an HTML comment:
   Supabase expands variables everywhere in the template.
4. **Authentication > Sign In / Providers > Email.** Set *Email OTP Length* to
   `6` and *Email OTP Expiration* to `900` seconds. The local config had 8;
   the code screen rejects anything that is not six digits. Keep *Confirm
   email* on.
5. **Authentication > Rate Limits.** Leave as they are. Note the current
   values and whether custom SMTP is configured (Authentication > Emails >
   SMTP Settings); the built-in sender allows very few emails an hour and is
   not meant for production, but that is a separate decision.
6. Send one sign-up and one sign-in to an iCloud and a Gmail address and
   confirm the code arrives and works on a phone.

## 3. Refund recovery status

| Check | Finding |
| --- | --- |
| Migration `202609170001_require_username_for_published_pages` | **Not applied** to hosted |
| Migration `202609170002_recover_stuck_booking_refunds` | **Not applied** to hosted |
| `ceaute.list_retryable_booking_refund_operations` | **Does not exist** on hosted |
| Cron job `ceaute-recover-booking-refunds` | **Does not exist**; only `ceaute-complete-bookings` and `ceaute-send-booking-emails` are scheduled, both active |
| Endpoint | `GET https://ceaute.com/api/cron/recover-booking-refunds` is deployed and answers 401 without the secret (404 for an unknown path) |
| Credentials | Vault secret `ceaute_cron_secret` exists. The two existing jobs use the same `invoke_cron_endpoint` and their recent `pg_net` responses are 41 x 200 and 1 x 500, so the secret matches the deployed `CRON_SECRET`. The new job will use the same path and secret |
| Execution history | None for recovery, because the job does not exist. Existing jobs: 223 and 37 succeeded runs |
| Refund operations | One, `succeeded`, with a Stripe refund id, consistent with the £15 test payment. One payment attempt, `refunded` |

So automatic recovery is **not installed** on hosted. The code on `main` is
deployed and waiting for the migration.

The single 500 at 07:00 UTC belongs to one of the two existing jobs. It was
not investigated because booking completion is out of scope here.

### Is the implementation safe? (code and SQL review)

- **Discoverable.** The list function returns `requested` operations, `pending`
  ones with no refund id or no webhook for an hour, and `processing` leases
  older than two minutes, all only after a two-minute grace so it does not
  race the synchronous driver. Terminal and `requires_review` operations are
  never listed.
- **Same idempotency key.** The key is a column on the operation, returned by
  `claim_booking_refund_operation` and passed to Stripe by
  `buildStripeRefundRequest`. No code path generates a new one.
- **No duplicate refunds.** Three independent layers: the claim takes a row
  lock and a two-minute lease; an operation that ever attempted a create is
  claimed as `verify_before_retry`, which lists Stripe's refunds for the
  PaymentIntent and adopts the one carrying this operation's id before any
  create; and a create that does happen reuses the key, so Stripe returns the
  original refund. The entitlement trigger additionally caps the sum of
  operations at the captured amount.
- **Ambiguity goes to review.** More refunds than can be inspected, a refund
  with this operation's id but another amount or PaymentIntent, refunds
  exceeding the capture, or a create that still cannot be proven after 23
  hours (before Stripe's 24-hour key expiry) all become `requires_review`,
  which no pass retries.
- **The £15 payment is safe from the pass.** Its operation is `succeeded`, so
  it is never listed, and a claim would answer `complete` without calling
  Stripe.

No code defect was found. Two behaviours worth knowing, neither changed:
a Stripe authentication or permission error is treated as definitive and
marks the refund `failed`, which the pass does not retry, so a revoked key
during a cancellation needs a manual follow-up; and Stripe replays a stored
5xx for the same key, so such an operation stays `pending` until the 23-hour
rule sends it to review. Both err on the side of not refunding twice.

## 4. Deployment steps (need approval; not run)

1. Apply the two pending migrations:

   ```bash
   npx supabase db push --linked
   ```

   `202609170001` adds a check constraint that fails if any published page
   has no username. Hosted had none when this was written; check again
   first:

   ```sql
   select count(*) from ceaute.provider_page
   where status = 'published' and username is null;
   ```

2. Confirm the job and function exist:

   ```sql
   select jobname, schedule, active, command from cron.job
   where jobname = 'ceaute-recover-booking-refunds';
   select 'ceaute.list_retryable_booking_refund_operations(integer)'::regprocedure;
   ```

3. After ten minutes confirm a run and a 200:

   ```sql
   select status, start_time from cron.job_run_details d
   join cron.job j using (jobid)
   where j.jobname = 'ceaute-recover-booking-refunds'
   order by start_time desc limit 3;
   select status_code, content::text, created from net._http_response
   order by created desc limit 5;
   ```

   An idle pass answers `{"listed":0,"outcomes":{},"failed":0}`.

## 5. Safe test-mode procedure for an interrupted refund

Preconditions: steps in section 4 are done; the deployed `STRIPE_SECRET_KEY`
and the local one both start `sk_test_`; never use the existing £15 payment.

**A. Stripe unavailable during cancellation (no hosted data is edited)**

1. On the deployed site make a **new** test booking with card
   `4242 4242 4242 4242` and wait for it to show as confirmed.
2. Run Ceaute locally against the same Supabase project with Stripe
   deliberately unconfigured, so the refund cannot be driven: comment out
   the `STRIPE_SECRET_KEY` line in `.env.local`, then `npm run dev`. (Do not
   rely on an empty shell variable; PowerShell removes it and `.env.local`
   wins.) Restore the line afterwards.

3. Locally, sign in as that customer and cancel the booking. An error screen
   is expected: PostgreSQL has cancelled the booking and recorded the refund
   operation, then `getStripe()` threw before any Stripe request was made.
   Stop the local server.
4. Confirm the interrupted state:

   ```sql
   select id, status, attempt_count, create_attempted_at, stripe_refund_id, idempotency_key
   from ceaute.booking_refund_operation order by created_at desc limit 1;
   ```

   Expect `requested`, `attempt_count = 0`, no refund id. Note the key. In
   Stripe test mode the payment has no refund.
5. Wait for the next ten-minute pass after the two-minute grace. Re-run the
   query: expect `succeeded` (or `pending` until the refund webhook), the
   **same** `idempotency_key`, `attempt_count = 1`, and a refund id. The
   latest `net._http_response` body shows `"outcomes":{"create":1}`.
6. In Stripe test mode open the PaymentIntent: exactly **one** refund, with
   `refund_operation_id` in its metadata equal to the operation id, and the
   transfer reversed.
7. Wait one more pass: `listed` is 0 and Stripe still shows one refund.

**B. Unknown outcome, reconciled before retry (optional; edits one test row,
so it needs approval)**

Repeat A1 to A4 with another new booking, then before the pass runs mark the
operation as if a create had been sent and its response lost:

```sql
update ceaute.booking_refund_operation
set status = 'pending',
    create_attempted_at = now() - interval '5 minutes',
    last_attempt_at = now() - interval '5 minutes'
where id = '<the new test operation id>' and status = 'requested';
```

The next pass claims it as `verify_before_retry`, lists Stripe's refunds,
finds none, and creates one with the original key. The response shows
`"outcomes":{"verify_before_retry":1}` and Stripe shows one refund. To prove
adoption instead of creation, first create the refund by hand in the Stripe
test dashboard **with metadata `refund_operation_id` = the operation id and
the exact amount**; the pass then answers `"reconciled":1` and creates
nothing.

Never run the update against an operation that is not `requested`, and never
against the £15 payment's operation.
