# Stripe webhooks for Preview integration testing

This document answers: **how should Stripe Test events reach the Vercel Preview
deployment that uses `ceaute-dev`?** Live activation remains in
[Stripe Live activation](stripe-live-activation.md).

## The boundary

Stripe Checkout return URLs and Stripe webhook destinations are independent.
The application puts `success_url` and `cancel_url` into each Checkout Session,
so `src/lib/app/origin.js` derives those URLs from the environment's canonical
`CEAUTE_APP_URL`. The integration Preview therefore sends customers back to
`https://preview.ceaute.com`; `VERCEL_URL` is only a missing-config fallback.

A Checkout Session has no webhook URL. Stripe sends account events to the
webhook destinations configured in Stripe Workbench (or through the Stripe
API), regardless of which deployment created the Session. `STRIPE_MODE` checks
the key and event mode; it does not select a destination. `CEAUTE_APP_URL`,
`VERCEL_URL`, and `VERCEL_BRANCH_URL` do not configure Stripe.

## Recommended Preview architecture

Ceaute's designated integration environment is the `preview` branch at
`https://preview.ceaute.com`, backed by `ceaute-dev` and Stripe Test. Production
is the `main` branch at `https://ceaute.com`, backed by `ceaute-prod` and Stripe
Live. The commit-specific `VERCEL_URL` changes on every deployment and must not
be copied into long-lived Stripe configuration or override `CEAUTE_APP_URL`.

Arbitrary ephemeral Preview deployments cannot each receive only the events
for Checkout Sessions they created. Stripe destinations subscribe to account
event types, not to Session metadata or a return URL. Supporting every Preview
concurrently would require destination lifecycle automation plus isolated
Stripe sandboxes/databases, or a trusted stable relay that verifies Stripe and
routes events. Ceaute has neither, so the designated integration Preview is the
simple supported model.

## Hosted configuration

These are hosted configuration invariants, not application routing logic:

1. In Vercel, the `preview` branch and `https://preview.ceaute.com` use
   `ceaute-dev`, `CEAUTE_APP_URL=https://preview.ceaute.com`, and Stripe Test.
2. In Stripe Test mode, the payments webhook destination is
   `https://preview.ceaute.com/api/stripe/payments`. It subscribes to:
   `checkout.session.completed`, `checkout.session.expired`,
   `payment_intent.payment_failed`, `payment_intent.canceled`, `refund.updated`,
   `refund.failed`, and the five `charge.dispute.*` events listed in
   [Stripe Live activation](stripe-live-activation.md).
3. Put that destination's signing secret in Vercel's **Preview**-scoped
   `STRIPE_PAYMENT_WEBHOOK_SECRET`. Signing secrets belong to destinations; do
   not copy the Live or Stripe CLI secret. Keep `STRIPE_MODE=test` and a Test
   secret or restricted API key in Preview.
4. If Preview deployment protection is enabled, configure Vercel's Protection
   Bypass for Automation and append its query parameter to the Stripe
   destination URL. Do not bypass the application's Stripe signature check.
5. Disable or repurpose the old **Test-mode** payments destination at
   `https://ceaute.com/api/stripe/payments` so Test events are not also sent to
   Production. Keep the **Live-mode** Production destination at `ceaute.com`.
6. If Connect onboarding is tested in Preview, make the same Test-versus-Live
   separation for the v2 Connect event destination at `/api/stripe/connect`
   and set its signing secret in Preview scope.

After configuration, use Stripe Workbench to resend the failed
`checkout.session.completed` event to the Preview payments destination, or
make a fresh Test booking. Confirm the destination delivery returns `2xx` and
the booking in `ceaute-dev` becomes `confirmed`.

## Local Stripe CLI use

`stripe listen --forward-to http://localhost:3000/api/stripe/payments` is for a
developer running Ceaute locally. The listener prints its own temporary signing
secret, which must be used by that local process. It is not persistent hosted
Preview routing and its secret is not the secret of a Workbench destination.
