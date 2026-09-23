# Domain model

This document answers: **what are Ceaute's core concepts, and how do they
relate?** It uses product language. For table and code boundaries, see
[architecture.md](architecture.md).

## People and public identity

A **user** is a person authenticated by Supabase. Authentication owns sign-in
identity, including email.

A **profile** is Ceaute's record for that user. It stores the name and phone
details needed across customer and provider journeys. A profile is not a role:
the same profile can own a provider page and be the customer on bookings.

A **provider** is a user acting through a provider page. It is a context, not a
separate account type.

A **provider page** is the provider's public storefront and the ownership root
for provider data. It owns treatments, organisation, availability, location,
portfolio, terms, Stripe connection, and provider-side bookings. One profile can
own at most one provider page. `providerPageId` always means the ID of this
record, whose database name is `provider_page`.

A provider page moves through separate states that are easy to conflate:
**setup complete** (every publication requirement is met; the **setup guide**
tracks these for a draft), **ready to publish** (a draft whose setup is
complete), **published** (visible; changed only by the provider on
Publication), **taking bookings** (published, and PostgreSQL agrees a new
booking may start: complete terms, Stripe ready, the current **provider
agreement** accepted, no balance owed) and **suspended** (set by Ceaute). A
published page that is not taking bookings is **paused**: still visible, with
no way to book.

## What a provider offers

A **treatment** is the main bookable offering. It has a name, an optional
description, a price of at least £1.00, a duration, active state, and one Ceaute
discovery category. A treatment
may belong to a provider-defined treatment group.

A **treatment group** is optional storefront organisation such as “Full sets”
or “Infills”. Its meaning belongs to one provider only. It is not a marketplace
taxonomy.

A **discovery category** is Ceaute's controlled classification used to find
providers by the kind of treatment they offer. Many providers can use the same
category while presenting their treatments in different groups.

An **add-on** is an optional modification which increases price, duration, or
both. It belongs to one provider page. A compatibility relationship joins it to
each treatment that permits it, allowing the same add-on to work with several
treatments without crossing provider ownership.

A **location** contains two views of the appointment place. The public area is
safe for discovery and the storefront. The street address, postcode, and access
instructions are private appointment information.

A provider page may save several locations, and exactly one of them is the
**current** location: where that provider is working from now. The storefront,
discovery, and every new booking use the current one. A customer never chooses
between a provider's saved locations and never sees that there is more than
one. Changing which location is current is how a provider says they have moved;
it is a deliberate act, not a side effect of editing a form.

**Availability** combines one weekly working period per weekday with whole
blocked dates. There is no slot entity. Candidate starts are calculated from
these rules, the requested duration, notice and window rules, and occupied
booking intervals.

## The booking contract

**Booking terms** belong to the provider page: **Full payment** or **Deposit**,
one **percentage**, and a **cancellation window** of 12, 24 or 48 hours, with
an optional written policy. For a deposit the percentage is what is **paid
now** (at least £1.00); for either mode it is what the provider **keeps** after
a late customer cancellation, never more than was paid. The rest of a deposit
booking is **due at the appointment**, outside Ceaute.

A **booking** joins one customer profile to one provider page, treatment, and
time interval. It begins as the temporary **hold** made by "Continue to
payment" (ten minutes, extended while Stripe Checkout is open); the **held
page** is where Stripe returns and where a hold can be finished. A paid hold
becomes confirmed, a past confirmed appointment becomes completed, and a
customer or provider may cancel a future confirmed appointment. Expired and
cancelled holds stop occupying the interval.

The booking is also the historical contract. Its customer snapshot preserves
the customer's contact details. Its service snapshot preserves the provider and
treatment names, selected add-ons, duration, price, the public and private
location the provider was working from when the hold was taken, payment
mode, percentage, the amount paid now and the amount kept after a late
cancellation (stored as `commitment_amount_pence`), cancellation window, and
written policy. Bookings made before percentage terms keep the fixed amounts
they were made with. Those
values remain meaningful after the current provider page or treatment changes.

A **payment attempt** records one attempt to create and complete Stripe Checkout
for a booking. A booking may accumulate attempts because failures and uncertain
network outcomes must be recoverable. It records the amount charged online, the
total appointment value, any balance due later, the Ceaute fee, Stripe IDs, and
processing state.

A **refund operation** is the durable instruction to return a particular amount
from one payment attempt. It has stable identity and can move through requested,
processing, pending, succeeded, failed, or manual-review states without losing
the booking's cancellation decision.

An **inspiration image** (an "inspiration photo" on screen) is a private
reference picture the customer attaches to their own confirmed booking to show
the provider the result they want. It belongs to the
booking, not to either person's profile, and it is never public. A booking can
carry up to five. They are optional: a booking with none is an ordinary booking.

A **review** is one rating and optional comment from the booking's customer for
a completed appointment. A booking has at most one review. Review visibility is
moderated separately from its existence so trust history is not deleted.

## Relationships in one view

```text
User ── 1 Profile ── 0..1 Provider Page
          │                 ├── Treatments ── Discovery Category
          │                 │       ├── optional Treatment Group
          │                 │       └── compatible Add-ons
          │                 ├── Locations (one current), availability, portfolio, terms
          │                 └── Stripe recipient account
          │
          └── customer on Bookings ── Payment Attempts ── Refund Operations
                              ├── 0..5 Inspiration Images
                              └── 0..1 Review
```

Provider-owned relationships are deliberately repeated in the schema where
needed. Composite keys and transaction checks prevent a treatment, add-on,
location, or booking input from being borrowed from another provider page.
