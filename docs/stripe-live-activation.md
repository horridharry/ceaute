# Stripe Live activation checklist

This document answers: **what must the owner do to switch Ceaute from Stripe
Test to Stripe Live?** Ceaute is in Test mode today and nothing here has been
done. Tick items off as they are completed.

The code is ready for the switch. `STRIPE_MODE` declares which mode a
deployment runs in and defaults to `test`, so nothing changes until it is set
deliberately. Ceaute refuses to make a Stripe call when `STRIPE_MODE` and
`STRIPE_SECRET_KEY` disagree, and both webhook endpoints reject an event whose
`livemode` does not match the declared mode.

## Decide these first — they cost money if skipped

- [x] **Set the platform fee.** Done. The provider bears Stripe's processing
      cost and a 2% Ceaute platform fee, both carried by
      `application_fee_amount`. See
      [decision 004](decisions/004-providers-bear-stripe-processing-fees.md).
      One residual exposure remains, recorded there: the processing component
      is an estimate at Stripe's published UK rate, so a commercial or non-UK
      card costs more than was retained and Ceaute absorbs the difference.
- [ ] **Decide who absorbs refunds and chargebacks.** Now modelled on all four
      scenarios in
      [the refund economics report](reports/2026-09-18-refund-economics-and-provider-liability.md),
      which sets out the three coherent answers and the draft agreement
      wording. Today Ceaute absorbs 35p on every fully refunded £10 deposit and
      goes negative on any partial refund above ~37%. A provider agreement can
      allocate the liability but cannot create a way to collect it: there is no
      set-off against future payouts.
- [x] **Handle dispute events.** Done, at the minimum useful level: all five
      `charge.dispute.*` events are recorded idempotently, the operator is
      emailed on every material moment, and `GET /api/operator/disputes` lists
      affected bookings. See [the dispute runbook](dispute-response.md).
      Still requires the five events to be added to the Live webhook endpoint
      below, and `CEAUTE_OPERATOR_EMAIL` and `CEAUTE_OPERATOR_SECRET` to be set.
- [ ] **Decide what Ceaute does about the money in a dispute.** Recording it
      does not recover it. A disputed £10.00 deposit costs Ceaute **£24.80**
      with no clawback and still **£15.35** after a perfect manual transfer
      reversal, because Stripe's Connect terms forbid passing the £15.00
      dispute fee to a connected account. Nothing reverses a transfer
      automatically and there is no set-off against future payouts.
- [ ] **Decide what happens to existing Test-mode data.** Stored `acct_*` and
      `pi_*` identifiers are UNIQUE with no mode column. After the switch every
      one of them refers to a non-existent Live object: provider accounts will
      fail to re-fetch while their cached row still reads `ready`, and any
      pre-switch PaymentIntent becomes permanently unrefundable. Either reset
      the payment-related data or accept that pre-switch bookings are frozen.

## Stripe Dashboard

- [ ] Complete Stripe account activation for the business (Live mode requires
      the full business details Test mode does not).
- [ ] Confirm the **live** account has access to the `2026-08-26.preview` API
      version. Two things depend on it: the Accounts v2 surface used for
      Connect onboarding, and `allowed_payment_method_types` on the Checkout
      Session payload. Preview access is granted per account and per mode — if
      the live account lacks it, Checkout creation fails on every booking.
- [ ] Enable **Connect** in Live and confirm recipient configuration is
      available.
- [ ] Set the public **statement descriptor**. With destination charges and no
      `on_behalf_of`, Ceaute is the settlement merchant and Ceaute's descriptor
      appears on the customer's statement. An unrecognisable descriptor causes
      chargebacks.
- [ ] Create the two Live webhook endpoints and copy their **new** signing
      secrets — they differ from the Test secrets:
      - `https://ceaute.com/api/stripe/payments` — `checkout.session.completed`,
        `checkout.session.expired`, `payment_intent.payment_failed`,
        `payment_intent.canceled`, `refund.updated`, `refund.failed`,
        `charge.dispute.created`, `charge.dispute.updated`,
        `charge.dispute.closed`, `charge.dispute.funds_withdrawn`,
        `charge.dispute.funds_reinstated`
      - `https://ceaute.com/api/stripe/connect` (v2 event destination) —
        `v2.core.account.created`, `v2.core.account.updated`,
        `v2.core.account[configuration.recipient].updated`,
        `v2.core.account[configuration.recipient].capability_status_updated`,
        `v2.core.account[requirements].updated`,
        `v2.core.account[future_requirements].updated`,
        `v2.core.account_link.returned`

## Vercel environment (Production scope only)

Change all four together. Changing the key without the mode, or the mode
without the key, fails fast at the first Stripe call rather than running in the
wrong mode.

- [ ] `STRIPE_MODE` → `live`
- [ ] `STRIPE_SECRET_KEY` → the `sk_live_…` key
- [ ] `STRIPE_PAYMENT_WEBHOOK_SECRET` → the Live payments endpoint secret
- [ ] `STRIPE_CONNECT_WEBHOOK_SECRET` → the Live Connect destination secret
- [ ] `CEAUTE_OPERATOR_EMAIL` → a mailbox somebody actually reads; dispute
      alerts go here
- [ ] `CEAUTE_OPERATOR_SECRET` → a fresh random token for the dispute listing

Leave Preview and Development on Test. See `.env.example` for the full set.

## Verify after switching

- [ ] One real provider completes Live Connect onboarding end to end, and their
      page publishes. This is the first proof that `payouts_status` reaches
      `active` under real KYC — Ceaute requests only the `stripe_transfers`
      capability but gates publication on payouts being active, which has never
      been exercised against live verification.
- [ ] One real booking, of a small amount, paid on a real card: booking
      confirms from the webhook (not the return URL), confirmation email
      arrives, exact address is released.
- [ ] Cancel that booking and confirm the refund reaches the card and the
      transfer reverses cleanly.
- [ ] Confirm the Supabase Vault secrets `ceaute_cron_secret` and, if used,
      `ceaute_cron_base_url` are set for the production project. Without the
      secret, `invoke_cron_endpoint` logs a notice and sends nothing — so
      stuck refunds would never be retried and nothing would report it.

## Not to be done

Do not activate Live while the legal identity placeholders remain: the
Production build is blocked by `scripts/assert-legal-identity.mjs` until the
trader's name and address are real. See
[the legal review note](reports/2026-09-18-legal-pages-review-note.md).
