# Pilot

How Ceaute's first real providers are brought on, and what they are told. This
repository is public: providers are named by the letters used in the
[26 September 2026 interview report](reports/2026-09-26-provider-interviews.md),
and no personal details are written here.

## Price during the pilot

Decided 27 September 2026 by the product owner. Every pilot provider, A
included, pays what the [provider agreement](provider-agreement-draft.md) says:
Ceaute's 2% of the money processed plus the estimated Stripe cost
([decision 004](decisions/004-providers-bear-stripe-processing-fees.md)), and
no subscription. Nobody is offered a subscription or a different price, and
subscriptions are not mentioned until they have been tested.

At these providers' deposits this loses money. 2% of a £10 deposit is 20p,
while Stripe charges Ceaute about £2 a month for each active provider. That
loss is accepted for the pilot. Every provider interview asks what they pay
today and what they would pay, so the pilot ends with a price.

## Legal during the pilot

Decided 28 September 2026 by the product owner. While every pilot provider is
a personal connection, Ceaute carries the minimum legal detail:

- `/terms` and `/privacy` are short versions, linked from the footer.
- Checkout has no "By continuing you agree" line and no trader details.
- Providers still accept the provider agreement before publishing, because it
  is what makes a lost dispute the provider's cost. The full agreement text is
  not shown in the product and no solicitor has read it (accepted risk).

Before the first provider who is not a personal connection joins, bring back
the full Terms and Privacy pages and the checkout line and trader details
(`git log` on those files has the full versions).

## Start dates

Decided 28 September 2026 by the product owner: C starts first, the provider
who takes bookings by Instagram DM and has no booking system. The start date
is UNDECIDED.

The interview report says C "could start now". That misreads the interview:
C was asked a hypothetical question ("imagine you started today, what would
hold you back?") to find blockers, and was not offered a start.

## Material for providers

Providers can be sent something that shows what Ceaute does, feature by
feature: a slide, a one-page overview or a short video. Its form is open, and
it is marketing kept outside this repository. It does not have to exist before
talking to more providers.
