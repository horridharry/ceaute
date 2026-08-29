# Ceaute PostgreSQL Schema

**Status:** Ready for review  
**Version:** 0.2  
**Last updated:** 29 August 2026  
**Based on:** Domain model v0.2 and architecture decisions v0.2

## What this document does

The domain model explains the things Ceaute needs to remember. This document turns those things into PostgreSQL tables, columns and guarantees.

It is exact enough to generate migrations and implementation tickets. It is not the migration itself.

The schema follows the same journey as the product:

```text
Account
→ provider page
→ services and availability
→ booking
→ payment, refund and review
```

Supporting tables for billing, webhooks, notifications and administrator actions come last.

---

## Rules used throughout the schema

### Where the tables live

Application tables live in a private `ceaute` PostgreSQL schema. Supabase's `auth.users` table continues to own authentication identities.

The browser does not receive direct access to the core booking and payment tables. Ceaute's server performs those operations. Row-level security remains enabled as defence in depth.

### IDs, dates and money

- Primary keys are UUIDs.
- Absolute times use `timestamptz`.
- Weekly working hours use local `time` values together with the provider's IANA time zone.
- Money uses whole pennies in `bigint` columns.
- Currency uses three-letter ISO codes; the MVP permits only `GBP`.
- Records that change normally have `created_at` and `updated_at`.

### Statuses

Statuses use `text` with check constraints rather than PostgreSQL enums. Adding a valid state later should be a small migration rather than an enum-management exercise.

### History

Provider catalogue records are archived instead of deleted after use. Bookings contain immutable snapshots and never depend on today's name, price, address or policy to explain yesterday's appointment.

### Keeping provider-owned records together

Several relationships must prove that both records belong to the same provider. The location, policy version, treatment group, treatment, add-on and booking tables therefore keep their UUID primary key and also expose a unique `(id, provider_page_id)` pair for composite foreign keys.

This stops a treatment from using another provider's group, an add-on from attaching to another provider's treatment or a booking from referencing another provider's policy or address.

### Extensions

The first migration enables:

- `pgcrypto` for generated UUIDs.
- `btree_gist` for the booking-overlap constraint.

---

## 1. Accounts and administrator access

### `profile`

This is Ceaute's information about one authenticated person. Its ID is the same as the person's Supabase Auth ID.

| Column | Type | Rule |
| --- | --- | --- |
| `id` | `uuid` | Primary key; foreign key to `auth.users.id`. |
| `full_name` | `varchar(120)` | Optional until the user books or completes provider setup. |
| `phone_e164` | `varchar(20)` | Optional until booking; stored in international format. |
| `phone_verified_at` | `timestamptz` | Null until SMS verification succeeds. |
| `created_at` | `timestamptz` | Required; defaults to now. |
| `updated_at` | `timestamptz` | Required; defaults to now. |

Email remains in Supabase Auth. A confirmed booking copies the verified email into its customer snapshot.

Deleting an Auth user must not blindly delete financial history. Account deletion becomes an explicit anonymisation workflow after real bookings exist.

### `admin_user`

This table grants a Ceaute account access to internal administration.

| Column | Type | Rule |
| --- | --- | --- |
| `profile_id` | `uuid` | Primary key; foreign key to `profile`. |
| `role` | `text` | `support` or `admin`. |
| `is_active` | `boolean` | Defaults to true. |
| `created_at` | `timestamptz` | Required. |

Administrator access is checked on the server. Removing or deactivating this row removes access without changing the person's ordinary Ceaute account.

---

## 2. Provider identity and publication

### `primary_category`

This is Ceaute's broad provider list: Nails, Lashes, Hair and similar categories.

| Column | Type | Rule |
| --- | --- | --- |
| `id` | `uuid` | Primary key. |
| `name` | `varchar(80)` | Required. |
| `slug` | `varchar(80)` | Required, lower-case and unique. |
| `is_active` | `boolean` | Defaults to true. |
| `display_order` | `integer` | Required and non-negative. |

The unique slug gives us case-insensitive identity without depending on the presentation name.

### `provider_page`

This is one solo provider's public business page.

| Column | Type | Rule |
| --- | --- | --- |
| `id` | `uuid` | Primary key. |
| `owner_profile_id` | `uuid` | Required foreign key to `profile`; unique. |
| `primary_category_id` | `uuid` | Nullable while draft; foreign key to `primary_category`. |
| `username` | `varchar(30)` | Nullable while draft; lower-case and unique when present. |
| `display_name` | `varchar(120)` | Nullable while draft. |
| `biography` | `varchar(500)` | Nullable while draft. |
| `status` | `text` | `draft`, `published` or `suspended`; defaults to `draft`. |
| `timezone` | `text` | Required; defaults to `Europe/London`. |
| `booking_window_days` | `smallint` | Required; 30, 60 or 90. |
| `published_at` | `timestamptz` | Null until first publication. |
| `created_at` | `timestamptz` | Required. |
| `updated_at` | `timestamptz` | Required. |

Important guarantees:

- `owner_profile_id` is unique: one account can own at most one provider page.
- `username` is unique when present.
- A username contains 3–30 lower-case letters, numbers, underscores or full stops.
- Discovery queries index `(status, primary_category_id)`.

The nullable profile fields are deliberate. Onboarding is resumable, so a draft must be allowed to exist before every answer is known.

Publishing is one server-side transaction that checks the page has all required fields, one active location, working hours, a treatment, a current policy and a Stripe account able to receive charges and payouts. Those facts span several tables, so a simple row constraint cannot express the whole publication rule.

The fixed 24-hour minimum notice is a product rule, not a provider setting, so it is not stored on every provider page.

### `provider_payment_account`

This records the provider's Stripe connected account and the latest onboarding state Ceaute has received.

| Column | Type | Rule |
| --- | --- | --- |
| `provider_page_id` | `uuid` | Primary key; foreign key to `provider_page`. |
| `stripe_account_id` | `text` | Required and unique. |
| `details_submitted` | `boolean` | Defaults to false. |
| `charges_enabled` | `boolean` | Defaults to false. |
| `payouts_enabled` | `boolean` | Defaults to false. |
| `onboarding_complete` | `boolean` | Defaults to false. |
| `updated_at` | `timestamptz` | Required. |

Stripe remains the authority for account capability. This table lets Ceaute make publication and support decisions without repeatedly calling Stripe.

### `provider_location`

This stores a current or previous service address.

| Column | Type | Rule |
| --- | --- | --- |
| `id` | `uuid` | Primary key. |
| `provider_page_id` | `uuid` | Required foreign key to `provider_page`. |
| `address_line_1` | `varchar(160)` | Required and private. |
| `address_line_2` | `varchar(160)` | Optional and private. |
| `city` | `varchar(100)` | Required and private. |
| `postcode` | `varchar(12)` | Required and private. |
| `country_code` | `char(2)` | Required; `GB` in the MVP. |
| `public_area` | `varchar(120)` | Required; shown before booking and used in search. |
| `access_instructions` | `text` | Optional; revealed only for a confirmed booking. |
| `is_active` | `boolean` | Defaults to false. |
| `created_at` | `timestamptz` | Required. |
| `retired_at` | `timestamptz` | Null while current. |

A partial unique index allows at most one active location per provider page. It cannot require every draft to have one; publication checks that separately.

Area search indexes a normalised lower-case form of `public_area` for active locations. Exact-address fields are never selected by public queries or included in public metadata.

### `portfolio_image`

This stores one image displayed on the provider page.

| Column | Type | Rule |
| --- | --- | --- |
| `id` | `uuid` | Primary key. |
| `provider_page_id` | `uuid` | Required foreign key to `provider_page`. |
| `storage_path` | `text` | Required and unique. |
| `alt_text` | `varchar(250)` | Optional. |
| `display_order` | `integer` | Required and non-negative. |
| `is_visible` | `boolean` | Defaults to true. |
| `created_at` | `timestamptz` | Required. |

Visible images have a unique `(provider_page_id, display_order)`. Reordering happens in one transaction so temporary position collisions do not leak into the final state.

---

## 3. Policies

### `policy_version`

This is one immutable version of the provider's booking and cancellation terms.

| Column | Type | Rule |
| --- | --- | --- |
| `id` | `uuid` | Primary key. |
| `provider_page_id` | `uuid` | Required foreign key to `provider_page`. |
| `version_number` | `integer` | Required and positive. |
| `payment_mode` | `text` | `full` or `deposit`. |
| `commitment_type` | `text` | `fixed` in the MVP; `percentage` is reserved for a later experiment. |
| `commitment_value` | `bigint` | Pence when fixed; basis points when percentage; greater than zero. |
| `cancellation_window_hours` | `smallint` | 12, 24 or 48. |
| `written_policy` | `text` | Required provider-written instructions. |
| `is_current` | `boolean` | Marks the version used for new bookings. |
| `created_at` | `timestamptz` | Required. |

The database guarantees:

- `(provider_page_id, version_number)` is unique.
- A partial unique index permits at most one current version per provider.
- An update trigger rejects changes to the meaningful policy fields after creation. To change policy, the application creates a new version and retires the old one in one transaction.

The UI exposes only fixed commitments in the MVP. Keeping the type separate from its value makes the assumption reversible. Bookings still store the actual commitment amount in pennies.

---

## 4. Treatment catalogue

### `discovery_category`

This is Ceaute's controlled treatment vocabulary used in search.

| Column | Type | Rule |
| --- | --- | --- |
| `id` | `uuid` | Primary key. |
| `name` | `varchar(100)` | Required. |
| `slug` | `varchar(100)` | Required, lower-case and unique. |
| `search_terms` | `text[]` | Optional synonyms. |
| `is_active` | `boolean` | Defaults to true. |
| `display_order` | `integer` | Required and non-negative. |

### `treatment_group`

This is a provider-created section such as Full sets or Infills.

| Column | Type | Rule |
| --- | --- | --- |
| `id` | `uuid` | Primary key. |
| `provider_page_id` | `uuid` | Required foreign key to `provider_page`. |
| `name` | `varchar(100)` | Required. |
| `display_order` | `integer` | Required and non-negative. |
| `is_active` | `boolean` | Defaults to true. |
| `created_at` | `timestamptz` | Required. |
| `updated_at` | `timestamptz` | Required. |

Active groups have unique names and display positions within one provider page.

### `treatment`

This is the main service a customer can book.

| Column | Type | Rule |
| --- | --- | --- |
| `id` | `uuid` | Primary key. |
| `provider_page_id` | `uuid` | Required foreign key to `provider_page`. |
| `treatment_group_id` | `uuid` | Required foreign key to `treatment_group`. |
| `discovery_category_id` | `uuid` | Required foreign key to `discovery_category`. |
| `name` | `varchar(140)` | Required. |
| `description` | `text` | Required. |
| `duration_minutes` | `smallint` | Positive and divisible by 15. |
| `price_pence` | `bigint` | Positive. |
| `display_order` | `integer` | Required and non-negative. |
| `is_active` | `boolean` | Defaults to true. |
| `created_at` | `timestamptz` | Required. |
| `updated_at` | `timestamptz` | Required. |

The direct `provider_page_id` makes ownership and provider-scoped queries explicit. A composite foreign key ensures the selected treatment group belongs to the same provider page.

Indexes support:

- Provider catalogue reads by `(provider_page_id, is_active, display_order)`.
- Discovery by `(discovery_category_id, is_active)`.
- Case-insensitive treatment-name matching.

### `addon`

This is an optional extra that may add price, duration or both.

| Column | Type | Rule |
| --- | --- | --- |
| `id` | `uuid` | Primary key. |
| `provider_page_id` | `uuid` | Required foreign key to `provider_page`. |
| `name` | `varchar(140)` | Required. |
| `description` | `text` | Optional. |
| `price_pence` | `bigint` | Zero or greater. |
| `duration_minutes` | `smallint` | Zero or greater and divisible by 15. |
| `is_active` | `boolean` | Defaults to true. |
| `created_at` | `timestamptz` | Required. |
| `updated_at` | `timestamptz` | Required. |

Active add-on names are unique within a provider page.

### `treatment_addon`

This relationship says which add-ons can be selected for which treatments.

| Column | Type | Rule |
| --- | --- | --- |
| `provider_page_id` | `uuid` | Required foreign key to `provider_page`. |
| `treatment_id` | `uuid` | Required. |
| `addon_id` | `uuid` | Required. |

The three columns form the primary key. Composite foreign keys to treatment and add-on guarantee that both belong to the same provider page.

---

## 5. Availability

### `availability_rule`

This is one normal working period for one weekday.

| Column | Type | Rule |
| --- | --- | --- |
| `id` | `uuid` | Primary key. |
| `provider_page_id` | `uuid` | Required foreign key to `provider_page`. |
| `weekday` | `smallint` | 0–6, where Monday is 0 and Sunday is 6. |
| `start_local_time` | `time` | Required. |
| `end_local_time` | `time` | Required and later than the start. |
| `created_at` | `timestamptz` | Required. |
| `updated_at` | `timestamptz` | Required. |

`(provider_page_id, weekday)` is unique, giving each provider at most one continuous working period per day.

### `blocked_date`

This removes one whole local date from the provider's normal schedule.

| Column | Type | Rule |
| --- | --- | --- |
| `id` | `uuid` | Primary key. |
| `provider_page_id` | `uuid` | Required foreign key to `provider_page`. |
| `local_date` | `date` | Required. |
| `reason` | `varchar(200)` | Optional and private. |
| `created_at` | `timestamptz` | Required. |

`(provider_page_id, local_date)` is unique.

There is no slot table. Empty times are calculated from these working rules, the provider's booking window, the fixed minimum notice, service duration and existing active bookings.

---

## 6. Bookings

### `booking`

This is the central appointment record. A booking awaiting payment also acts as the ten-minute reservation described in the domain model.

| Column | Type | Rule |
| --- | --- | --- |
| `id` | `uuid` | Primary key. |
| `customer_profile_id` | `uuid` | Required foreign key to `profile`. |
| `provider_page_id` | `uuid` | Required foreign key to `provider_page`. |
| `treatment_id` | `uuid` | Required foreign key to `treatment`. |
| `policy_version_id` | `uuid` | Required foreign key to `policy_version`. |
| `provider_location_id` | `uuid` | Required foreign key to the location used for this appointment. |
| `status` | `text` | Booking lifecycle state. |
| `start_at` | `timestamptz` | Required. |
| `end_at` | `timestamptz` | Required and later than `start_at`. |
| `hold_expires_at` | `timestamptz` | Required only while awaiting payment. |
| `currency` | `char(3)` | Required; `GBP` in the MVP. |
| `total_value_pence` | `bigint` | Required and positive. |
| `online_amount_pence` | `bigint` | Required and positive. |
| `offline_balance_pence` | `bigint` | Required and non-negative. |
| `ceaute_fee_pence` | `bigint` | Required and non-negative. |
| `processor_fee_pence` | `bigint` | Nullable until Stripe reports it. |
| `provider_online_amount_pence` | `bigint` | Nullable until known. |
| `refunded_amount_pence` | `bigint` | Required; defaults to zero. |
| `retained_amount_pence` | `bigint` | Required; defaults to zero. |
| `customer_snapshot` | `jsonb` | Required and immutable. |
| `provider_snapshot` | `jsonb` | Required and immutable. |
| `service_snapshot` | `jsonb` | Required and immutable. |
| `policy_snapshot` | `jsonb` | Required and immutable. |
| `created_at` | `timestamptz` | Required. |
| `updated_at` | `timestamptz` | Required. |

Allowed booking states are:

- `awaiting_payment`
- `confirmed`
- `cancelled_by_customer`
- `cancelled_by_provider`
- `completed`
- `expired`

The application permits only the lifecycle transitions defined in the domain model. The database check prevents unknown states.

Composite foreign keys using `provider_page_id` ensure that the treatment, policy version and location all belong to the provider receiving the booking. Supporting `(id, provider_page_id)` unique constraints exist on those referenced tables.

### Money checks on the booking

The database checks that:

```text
total value = online amount + offline balance
refunded amount <= online amount
retained amount <= online amount
```

Every amount is non-negative. The application separately calculates whether the deposit is high enough to cover the fee because that calculation depends on the provider's current commercial configuration.

### Snapshot contents

The JSON snapshots use versioned, validated application structures rather than arbitrary objects.

| Snapshot | Contents |
| --- | --- |
| `customer_snapshot` | Full name, verified email and booking phone number. |
| `provider_snapshot` | Display name, username, public area, exact address and access instructions. |
| `service_snapshot` | Treatment details and a summary of selected add-ons. |
| `policy_snapshot` | Payment mode, commitment amount, cancellation deadline, refund rules and written policy. |

The important times and money amounts remain ordinary columns because Ceaute filters and calculates with them.

An update trigger prevents changes to snapshot fields after the booking moves out of `awaiting_payment`. A confirmed booking's agreement cannot be rewritten.

### Preventing double booking

PostgreSQL provides the final booking guarantee:

```sql
EXCLUDE USING gist (
  provider_page_id WITH =,
  tstzrange(start_at, end_at, '[)') WITH &&
)
WHERE (status IN ('awaiting_payment', 'confirmed'))
```

The half-open range means a booking ending at 12:00 does not overlap one starting at 12:00.

Before inserting a new awaiting-payment booking, the same transaction expires any old holds that have passed `hold_expires_at`. A scheduled job also clears abandoned holds.

Indexes support:

- Provider diary: `(provider_page_id, start_at)`.
- Customer history: `(customer_profile_id, start_at desc)`.
- Hold expiry: `(status, hold_expires_at)`.
- Automatic completion: `(status, end_at)`.

### `booking_addon`

This records an add-on selected for a booking and its booking-time values.

| Column | Type | Rule |
| --- | --- | --- |
| `booking_id` | `uuid` | Required foreign key to `booking`. |
| `provider_page_id` | `uuid` | Required foreign key to `provider_page`. |
| `addon_id` | `uuid` | Required foreign key to `addon`. |
| `name_snapshot` | `varchar(140)` | Required. |
| `price_pence_snapshot` | `bigint` | Required and non-negative. |
| `duration_minutes_snapshot` | `smallint` | Required, non-negative and divisible by 15. |

`(booking_id, addon_id)` is the primary key. Composite foreign keys using `provider_page_id` ensure the booking and add-on belong to the same provider.

---

## 7. Payments and refunds

### `payment`

This records one Stripe PaymentIntent attempt for a booking.

| Column | Type | Rule |
| --- | --- | --- |
| `id` | `uuid` | Primary key. |
| `booking_id` | `uuid` | Required foreign key to `booking`. |
| `stripe_account_id` | `text` | Required connected provider account. |
| `stripe_payment_intent_id` | `text` | Required. |
| `idempotency_key` | `text` | Required and unique. |
| `status` | `text` | `pending`, `requires_action`, `processing`, `succeeded`, `failed` or `cancelled`. |
| `amount_pence` | `bigint` | Required and positive. |
| `application_fee_pence` | `bigint` | Required and non-negative. |
| `processor_fee_pence` | `bigint` | Nullable until Stripe reports it. |
| `currency` | `char(3)` | Required; `GBP` in the MVP. |
| `failure_code` | `text` | Optional. |
| `created_at` | `timestamptz` | Required. |
| `succeeded_at` | `timestamptz` | Null until successful. |

Important guarantees:

- `(stripe_account_id, stripe_payment_intent_id)` is unique.
- A partial unique index permits only one successful booking payment per booking.
- `idempotency_key` prevents the application creating a second Stripe attempt for the same intended operation.
- `booking_id` is indexed for payment history.

The booking stores the final commercial breakdown. The payment stores what happened through Stripe.

### `refund`

This records one full or partial refund attempt.

| Column | Type | Rule |
| --- | --- | --- |
| `id` | `uuid` | Primary key. |
| `payment_id` | `uuid` | Required foreign key to `payment`. |
| `stripe_refund_id` | `text` | Unique once Stripe creates it. |
| `idempotency_key` | `text` | Required and unique. |
| `reason` | `text` | `customer_early`, `customer_late`, `provider`, `admin` or `correction`. |
| `status` | `text` | `requested`, `pending`, `succeeded`, `failed` or `cancelled`. |
| `amount_pence` | `bigint` | Required and positive. |
| `application_fee_refund_pence` | `bigint` | Required and non-negative. |
| `unrecovered_processing_cost_pence` | `bigint` | Required; defaults to zero. |
| `failure_code` | `text` | Optional. |
| `created_at` | `timestamptz` | Required. |
| `completed_at` | `timestamptz` | Null until final. |

`payment_id` and `status` are indexed.

A retry reuses the same refund operation and idempotency key. When a refund succeeds, the booking's refunded total is updated in the same database transaction that records the successful result.

`unrecovered_processing_cost_pence` lets Ceaute measure the cost it absorbs when a provider cancels during the alpha.

---

## 8. Reviews

### `review`

This is one customer's review of one completed booking.

| Column | Type | Rule |
| --- | --- | --- |
| `id` | `uuid` | Primary key. |
| `booking_id` | `uuid` | Required foreign key to `booking`; unique. |
| `rating` | `smallint` | Required; 1–5. |
| `comment` | `text` | Optional. |
| `moderation_status` | `text` | `published`, `hidden` or `removed`. |
| `created_at` | `timestamptz` | Required. |
| `updated_at` | `timestamptz` | Required. |

The unique booking link guarantees one review per booking.

The server also checks that the booking is completed, belongs to the current customer and the customer's current phone number is verified. Those facts span several rows and current authentication state, so they are enforced in the review transaction rather than a simple check constraint.

Public reviews are found by joining through the booking's provider page.

---

## 9. Provider billing

### `provider_billing`

This stores both the provider's current commercial configuration and any Stripe subscription used to collect it.

| Column | Type | Rule |
| --- | --- | --- |
| `provider_page_id` | `uuid` | Primary key; foreign key to `provider_page`. |
| `monthly_subscription_pence` | `bigint` | Required and non-negative. |
| `commission_basis_points` | `integer` | Required; 0–10,000. One percent is 100 basis points. |
| `trial_ends_at` | `timestamptz` | Optional. |
| `billing_enabled` | `boolean` | Defaults to false for free alpha providers. |
| `stripe_customer_id` | `text` | Optional and unique when present. |
| `stripe_subscription_id` | `text` | Optional and unique when present. |
| `subscription_status` | `text` | `not_started`, `trialing`, `active`, `past_due`, `cancelled` or `paused`. |
| `current_period_ends_at` | `timestamptz` | Optional. |
| `updated_at` | `timestamptz` | Required. |

This table controls future fees. Every booking stores the Ceaute fee actually calculated for it, so later pricing changes never rewrite history.

---

## 10. Reliable events and notifications

### `payment_webhook_event`

This records every Stripe event Ceaute receives before applying it.

| Column | Type | Rule |
| --- | --- | --- |
| `stripe_event_id` | `text` | Primary key. |
| `stripe_account_id` | `text` | Connected account when relevant. |
| `event_type` | `text` | Required. |
| `processing_status` | `text` | `received`, `processed` or `failed`. |
| `attempt_count` | `integer` | Required; defaults to zero. |
| `last_error` | `text` | Optional. |
| `received_at` | `timestamptz` | Required. |
| `processed_at` | `timestamptz` | Optional. |

The Stripe event ID is the primary key. Receiving the same webhook again finds the existing row instead of applying the event twice.

### `notification_delivery`

This records one email or SMS that Ceaute intends to send.

| Column | Type | Rule |
| --- | --- | --- |
| `id` | `uuid` | Primary key. |
| `booking_id` | `uuid` | Optional foreign key to `booking`. |
| `type` | `text` | Required notification purpose. |
| `channel` | `text` | `email` or `sms`. |
| `recipient` | `text` | Required email address or phone number. |
| `status` | `text` | `pending`, `sent` or `failed`. |
| `deduplication_key` | `text` | Required and unique. |
| `provider_message_id` | `text` | Optional external reference. |
| `attempt_count` | `integer` | Required; defaults to zero. |
| `last_error` | `text` | Optional. |
| `created_at` | `timestamptz` | Required. |
| `sent_at` | `timestamptz` | Optional. |

The deduplication key prevents a retried booking event from sending the same logical notification twice. Failed deliveries can be retried without changing the booking.

---

## 11. Administrator audit history

### `admin_audit_event`

This records a sensitive action taken through Ceaute's internal tools.

| Column | Type | Rule |
| --- | --- | --- |
| `id` | `uuid` | Primary key. |
| `admin_profile_id` | `uuid` | Required foreign key to `admin_user.profile_id`. |
| `action` | `text` | Required. |
| `target_type` | `text` | Required. |
| `target_id` | `uuid` | Optional. |
| `details` | `jsonb` | Required; defaults to an empty object. |
| `created_at` | `timestamptz` | Required. |

Refunds, page suspensions, category changes, review moderation and billing overrides create an audit event.

Audit rows are append-only. They are never edited to rewrite what an administrator did.

---

## 12. What may be deleted and what must remain

Ceaute uses deletion carefully because booking and payment history must remain understandable.

| Relationship | Behaviour |
| --- | --- |
| Auth user → profile | Do not cascade once bookings exist. Use an explicit anonymisation and retention workflow. |
| Provider page → provider data | A never-published page with no bookings may be deleted. Otherwise close or suspend it. |
| Treatment group, treatment or add-on | Archive after use. Foreign keys restrict deletion while history references the record. |
| Location or policy version | Retain while referenced by a booking, even though the booking also has snapshots. |
| Booking → payment, refund or review | Restrict deletion. Financial and trust history remains consistent. |
| Operational event and audit rows | Retain according to the future legal and operational retention policy. |

Foreign keys default to `restrict` for historical and financial records. Application workflows perform closure, archive and anonymisation deliberately.

---

## 13. The database guarantees that matter most

These are the invariants we enforce in PostgreSQL rather than trusting every application path:

1. One provider page per owner account.
2. Unique public usernames.
3. At most one active location per provider page.
4. At most one current policy version per provider page.
5. One normal working period per provider and weekday.
6. Only 30, 60 or 90-day booking windows.
7. Treatment and add-on durations use 15-minute increments.
8. Treatment groups, treatments and add-ons cannot cross provider ownership.
9. Awaiting-payment and confirmed bookings cannot overlap for one provider.
10. Booking money balances arithmetically.
11. One successful booking payment per booking.
12. One review per booking.
13. One application of each Stripe webhook event.
14. Booking snapshots and audit events cannot be rewritten.

Rules that depend on several current records or external state remain server-side transaction checks. Publishing a provider and confirming review eligibility are the clearest examples.

---

## 14. Indexes by real product need

The schema adds indexes because a known user journey needs them, not as decoration.

| User journey | Index shape |
| --- | --- |
| Find a provider by username | Unique `provider_page.username`. |
| Search published providers by broad category | `provider_page(status, primary_category_id)`. |
| Search the active public area | Normalised `provider_location.public_area` where active. |
| Find providers offering a treatment | `treatment(discovery_category_id, is_active)`. |
| Render a provider's catalogue | Provider, active state and display order on groups, treatments and add-ons. |
| Show a provider's diary | `booking(provider_page_id, start_at)`. |
| Show a customer's bookings | `booking(customer_profile_id, start_at desc)`. |
| Expire abandoned checkouts | `booking(status, hold_expires_at)`. |
| Complete past appointments | `booking(status, end_at)`. |
| Reconcile payments and refunds | Stripe references, booking/payment foreign keys and status. |
| Retry failed operational work | Status on webhook and notification records. |

We should measure real query plans before adding further indexes.

---

## 15. Migration order

The first migration series is created in dependency order:

1. Extensions and the private `ceaute` schema.
2. Profiles, administrator access and Ceaute categories.
3. Provider pages, payment accounts, locations and portfolio images.
4. Policy versions.
5. Treatment groups, treatments, add-ons and eligibility links.
6. Weekly availability and blocked dates.
7. Bookings and selected add-ons.
8. Payments and refunds.
9. Reviews and provider billing.
10. Webhook, notification and audit records.
11. Partial indexes, overlap constraints and immutability triggers.
12. Row-level security policies and minimum grants.

This order is for migration construction, not implementation priority. GitHub issues will still be organised around working vertical slices.

---

## 16. What belongs in tickets rather than this document

The schema deliberately does not contain:

- Full `CREATE TABLE` migration code.
- ORM or query-builder definitions.
- Row-level security policy SQL.
- Seed category values.
- Stripe webhook handlers.
- Availability query implementation.
- Repository folder structure.

Those details should be written only when the relevant vertical-slice issue is ready to implement. The issue will point back to this schema instead of duplicating it.

## Schema outcome

The schema contains 24 tables. Twenty represent Ceaute's product and four provide administrator access, reliable external events, notifications and audit history.

The important result is not the table count. It is that the database can explain every booking, prevent the same appointment from being sold twice and preserve the money and policies that applied when the customer paid.
