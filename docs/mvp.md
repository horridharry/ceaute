# Ceaute MVP

**Status:** Ready for review  
**Version:** 0.2  
**Last updated:** 28 August 2026

## What we are building

Ceaute is a place to discover and book independent beauty providers.

The first version is for solo providers: nail technicians, lash technicians, hairstylists, braiders, makeup artists and similar professionals whose business is built around their own work and reputation.

The MVP needs to prove one complete loop:

> A provider can set up a credible page, publish services and availability, receive a paid booking and manage it. A customer can find that provider, understand what they offer, book safely and leave a genuine review afterwards.

If Ceaute cannot complete that loop reliably, discovery features and cultural positioning do not matter yet.

This is not salon-management software. We are not building staff rotas, rooms, inventory, payroll or a general business operating system.

---

## Who the MVP is for

The initial provider is usually:

- Working alone rather than running a multi-person salon.
- Finding customers through Instagram, TikTok or word of mouth.
- Using Acuity, another generic scheduler or manual messages (Instagram DMs).
- Selling services under their own name or personal brand.
- Working from one location at a time.
- Taking a deposit online, then collecting the balance in cash or by bank transfer.
- Used to manually releasing a month of appointments at once.
- Relying on portfolio images, policies and customer trust to win bookings.

The customer is someone who either finds the provider through Ceaute or opens the provider's direct Ceaute link from social media.

---

## The product in one view

A user has one Ceaute account. That account can book other providers and can also create one provider page.

The MVP has four useful roles:

- A **visitor** can search and view provider pages.
- A **customer** can book, pay, cancel and review.
- A **provider** can publish one page and manage its bookings.
- A **Ceaute administrator** can support users, inspect payments and deal with problems.

"Customer" and "provider" are not separate types of person. They describe what the user is doing at that moment.

---

## How a provider joins Ceaute

Provider setup should feel like a checklist, not one enormous form. Progress is saved so the provider can leave and return.

The provider completes these parts:

1. **Account** — sign in through email.
2. **Profile** — choose a display name, username, primary beauty category and short bio.
3. **Active location** — provide the exact private address and approve the public area customers will see.
4. **Working hours** — choose working days and one continuous period for each day.
5. **Blocked dates** — block whole dates for holidays, sickness or personal commitments.
6. **Services** — create treatment groups, treatments and any relevant add-ons.
7. **Payment rules** — choose full payment or a fixed deposit.
8. **Cancellation rules** — choose a 12, 24 or 48-hour deadline.
9. **Policies** — write practical instructions about lateness, preparation, guests and aftercare.
10. **Portfolio** — upload images of their work.
11. **Payments** — connect the account that will receive customer money.
12. **Publish** — make the page publicly bookable.

A page can be published when the required profile information, active location, working hours, treatment, payment account and booking rules are complete.

Portfolio images should be strongly prompted because the page is far less credible without them, but they do not block publishing in the first version.

Each provider receives a page such as:

```text
ceaute.com/@wlashedit
```

The provider may change their username. In the MVP, the old link stops working; redirects and reserved old usernames come later.

---

## The provider page

The page is both a portfolio and a booking page. It should feel like the provider's own professional space, not a generic scheduling form.

It shows:

- Display name, username and bio.
- Primary beauty category.
- Current public area.
- Portfolio images.
- Treatment groups and treatments.
- Price and duration for each treatment.
- Optional add-ons.
- Payment and cancellation terms.
- Provider-written policies.
- Reviews from completed Ceaute bookings.
- A clear route into booking.

It must work well inside the Instagram and TikTok in-app browsers because many customers will arrive from a social link.

---

## Discovery: how customers find the right service

The first search experience has only two inputs:

- Area.
- Treatment.

For example:

```text
Acrylic nails + Manchester
```

Ceaute returns published providers who currently work in Manchester and offer a matching treatment.

The initial ranking can be simple: exact area and treatment matches first, followed by relevant treatment-name matches. Paid ranking, personal recommendations and distance calculations are outside the MVP.

### Why Ceaute needs two kinds of treatment category

Providers organise services in their own language, but discovery needs consistent language across the marketplace. Ceaute therefore keeps two separate ideas.

**Discovery category** means the standard service Ceaute uses for search.

Examples:

- Acrylic nails.
- Gel nails.
- Lash extensions.
- Knotless braids.
- Facials.

The provider selects the closest Ceaute category when creating a treatment.

**Treatment group** means how the provider wants services arranged on their own page.

A nail technician might create:

- French tips.
- Freestyle.
- Infills.
- Plain sets.
- Removals.

These groups do not affect the wider marketplace and do not need Ceaute approval.

For example:

| What the customer sees     | Value              |
| -------------------------- | ------------------ |
| Treatment                  | French Tips Long   |
| Discovery category         | Acrylic nails      |
| Provider's treatment group | French tips        |
| Duration                   | 2 hours 30 minutes |
| Price                      | £51                |

Put simply:

- The discovery category answers, **"What standard service is this?"**
- The treatment group answers, **"Where should this provider display it?"**

If Ceaute does not yet recognise a new treatment, the provider chooses the nearest discovery category and still writes the real treatment name. They can suggest a new category without delaying publication.

---

## Location: one active place, not a customer choice

Every provider page has one currently active location.

The active location decides:

- Where the provider appears in search.
- Which area is shown on the public page.
- Where every newly created appointment takes place.
- Which exact address is revealed after payment.

The customer does not select a location during booking. If they searched for a provider in London and opened a London provider, asking them to select London again is pointless.

The public page shows only an area such as **Woolwich, South East London**. The exact address and access instructions remain private until the customer has a confirmed booking.

### When a provider moves

The provider can replace their active location. The new location affects search and new bookings immediately.

Existing bookings keep the location that applied when they were made. A provider cannot silently move an already-confirmed customer to a different address.

The MVP does not schedule future location changes or publish multiple locations at once. If this becomes a real adoption problem, we add it later with evidence rather than rebuilding the multiple-calendar behaviour we have deliberately removed.

---

## Availability: how bookable times are created

The provider chooses weekly working hours. Each working day has one continuous period.

```text
Monday       10:00–18:00
Tuesday      10:00–18:00
Wednesday    10:00–18:00
Friday       12:00–20:00
```

Split shifts are not supported in the MVP.

The provider can also:

- Block a whole date for holidays, sickness or personal commitments.

Ceaute uses a fixed 60-day booking window and fixed 24-hour minimum notice. A customer cannot book a slot that starts less than 24 hours away or more than 60 days ahead.

The fixed rolling window deliberately replaces monthly slot releases. Providers no longer need to reopen the next month manually; a new day becomes available automatically as the calendar moves forward. Provider controls for booking window and minimum notice are deferred until real usage shows they are needed.

### How start times work

Treatments include the normal preparation and cleanup time. Add-ons may add more time. There is no separate buffer setting yet.

Ceaute calculates possible starts in 15-minute steps from the provider's opening time. A time is offered only when the full treatment and its add-ons fit inside working hours and do not overlap another booking.

We calculate availability from working rules and bookings. We do not save thousands of empty slots in advance.

When a customer starts paying, Ceaute holds the selected time for 10 minutes. The hold expires if payment fails or is abandoned. The database must still prevent two customers from successfully booking overlapping times.

---

## Treatments and add-ons

A treatment contains:

- Name.
- Discovery category.
- Provider treatment group.
- Description.
- Duration.
- Price.
- Display order.
- Active or archived state.

Providers archive old treatments instead of deleting them. This preserves accurate historical bookings.

Add-ons are included because they are common and can change both price and duration.

An add-on contains:

- Name and optional description.
- Additional price.
- Additional time, which may be zero.
- The treatments it can be used with.
- Active or archived state.

Customers can choose several compatible add-ons. They choose them before the appointment time because extra duration can change which times are available.

The MVP does not support quantities, required add-ons, conditional choices or bundles.

---

## The customer booking journey

From a provider page, the journey is:

1. Choose a treatment group.
2. Choose a treatment.
3. Choose optional add-ons.
4. Choose an available date and time.
5. Sign in or create an account by email.
6. Confirm full name and phone number.
7. Review the complete order.
8. Pay and confirm.
9. See confirmation and the exact address.
10. Receive a confirmation email.

There is no location step because every available time already belongs to the provider's active location.

Before payment, the customer sees:

- Treatment and add-ons.
- Date, start time, end time and time zone.
- Total service price.
- Amount due now.
- Balance due at the appointment, if any.
- Public area.
- Cancellation deadline.
- How much money is at risk after that deadline.

The customer does not tick a policy checkbox. The payment action makes acceptance clear:

> By paying and confirming, you agree to this provider's booking and cancellation policies.

Ceaute records the exact policy version and financial terms shown for that booking.

---

## Accounts and customer contact details

Ceaute uses passwordless email authentication in the MVP. A user follows an email link or enters a one-time code.

A customer must provide:

- Full name.
- Verified account email.
- Phone number.

The phone number is required for urgent appointment contact but is not verified during checkout. SMS verification happens only when the customer first leaves a review. This avoids adding an OTP step to every first booking while still making reviews harder to fake.

---

## Payments: what the customer pays and what the provider receives

The provider connects a payment account before publishing. Ceaute uses a marketplace payment system such as Stripe Connect so customer money and provider payouts are not handled through manual bank transfers by Ceaute.

The provider chooses one payment rule for their whole page:

- **Full payment:** the customer pays the complete service value online.
- **Fixed deposit:** the customer pays one fixed amount online and pays the remaining balance directly to the provider at the appointment.

Per-treatment payment rules are deferred because one page-wide rule is easier for both sides to understand.

### Fixed deposits are an MVP assumption

The providers observed so far use fixed deposits such as £10 or £16. We will therefore launch with a fixed deposit rather than a percentage.

This is an explicit experiment, not a permanent truth. The system keeps the configuration type separate from its value so percentage deposits can be introduced later without changing old bookings.

For a £61 service with a £16 deposit:

```text
Service value                 £61
Paid online                   £16
Due at the appointment        £45
```

The deposit must be greater than zero, lower than the cheapest active treatment and large enough to cover the applicable online fees.

Ceaute shows the offline balance but does not record whether the provider later received cash or bank transfer.

### How Ceaute charges commission

Ceaute calculates commission from the full booking value, not only the deposit. Otherwise providers could reduce Ceaute's fee simply by collecting more money offline.

The commission is collected from the amount paid online, so the deposit must be large enough to cover processing, Ceaute's fee and a minimum provider amount.

Each booking permanently records:

- Total service value.
- Amount paid online.
- Offline balance.
- Processing fee.
- Ceaute fee.
- Provider's online amount.
- Any refunded amount.
- Any amount retained after cancellation.

Later changes to prices or fees never rewrite old bookings.

---

## Confirmation, cancellation and refunds

Successful payment confirms the booking immediately. The provider does not manually approve it.

Customers see only three simple states:

- Confirmed.
- Completed.
- Cancelled.

Internally, Ceaute also distinguishes payment pending, customer cancellation, provider cancellation and expired payment holds.

A confirmed booking becomes completed automatically after its scheduled end time.

### Customer cancellation

The provider chooses a page-wide deadline of 12, 24 or 48 hours. The default is 48 hours because both observed providers use it.

If the customer cancels at or before the deadline, Ceaute refunds everything paid online.

If they cancel after the deadline:

- For a deposit booking, Ceaute retains the deposit.
- For a full-payment booking, Ceaute retains the fixed commitment amount and refunds the rest.

The booking uses the rules that were accepted when it was created, not whatever the provider's current settings happen to be.

### Provider cancellation

If the provider cancels, the customer receives a full refund and the time becomes available again.

During the private alpha, Ceaute absorbs any processing cost the payment provider does not return. We record that cost separately so responsibility can change later without changing customer refunds.

### What is deliberately absent

- There is no native rescheduling. The customer cancels and books again.
- There is no separate no-show status.
- Ceaute does not calculate lateness or no-show fees.

Providers may describe these expectations in their written policies, but Ceaute does not enforce them yet.

---

## What Ceaute enforces and what the provider merely states

This distinction matters.

Ceaute enforces the structured rules that affect money and bookings:

- Full payment or deposit.
- Deposit and offline balance.
- Cancellation deadline.
- Early and late cancellation outcomes.
- Full refund after provider cancellation.
- Exact-address release after confirmation.

The provider writes the operational instructions:

- Preparation requirements.
- Lateness expectations.
- Guests.
- Allergies and patch tests.
- Infills.
- Aftercare.
- Work completed by another technician.

Written policies are shown clearly but are not automatically interpreted or enforced by the system.

Custom questionnaires, allergy forms and inspiration uploads are deferred. Adding them now would create a form-builder product inside the booking MVP.

---

## Managing bookings

The customer can:

- View upcoming and previous bookings.
- See the exact address for confirmed bookings.
- See what they paid and any balance due.
- Cancel and see the refund result.
- Review an eligible completed booking.

The provider can:

- View upcoming, previous and cancelled bookings.
- See the customer's name, email and phone number.
- See treatments, add-ons and appointment duration.
- See the online amount and offline balance.
- See the policy version attached to the booking.
- Cancel and refund a booking.

The provider dashboard may also show four simple totals: upcoming confirmed bookings, completed bookings this month, booked service value this month and online money collected this month.

We are not building a drag-and-drop calendar, manual appointment creation, attendance marking, customer notes or exports in the MVP.

---

## Reviews and trust

A customer may leave one review when:

- The booking belongs to them.
- The booking is completed.
- Their phone number has been verified.
- That booking has not already been reviewed.

A review contains a required 1–5 rating and an optional comment. It appears publicly as coming from a completed Ceaute booking.

Providers cannot delete negative reviews. Ceaute administrators can moderate fraud, abuse and personal information.

Imported, anonymous and unverified reviews are outside the MVP. Provider replies also come later.

---

## Notifications

The MVP sends email for:

- A new confirmed booking.
- A customer cancellation and its refund result.
- A provider cancellation and full refund.

Both customer and provider receive the relevant message.

SMS is used only for review phone verification. Appointment reminders, marketing and availability announcements are deferred.

---

## How Ceaute makes money

Ceaute intends to charge:

- A monthly provider subscription.
- Commission on bookings.

Both values can be set independently, including to zero. This lets us run:

1. A free private alpha to test whether the product works.
2. A paid beta to test whether providers will pay for it.

We begin the alpha with subscription and commission set to £0 for selected providers. Pricing can change without a code release, and every booking records the fee rules that applied to it.

Final public pricing is a later commercial decision, not a reason to delay the MVP.

---

## What Ceaute needs internally

Before taking real payments, Ceaute needs a basic operating view. It does not need to look polished.

An administrator must be able to:

- Find providers, customers and bookings.
- See whether a provider page and payment account are active.
- Hide or restore a provider page.
- Inspect payments, refunds and failed events.
- Retry a safe, authorised refund.
- Manage Ceaute's categories.
- Moderate reviews.
- Apply trials and provider-specific pricing overrides.

Important actions must be authenticated and recorded.

---

## Technical shape

Ceaute is a full-stack Next.js application.

For the MVP:

- Supabase Auth handles passwordless accounts.
- Supabase Storage holds portfolio images.
- Supabase-hosted PostgreSQL stores product data.
- Stripe Connect handles marketplace payments and provider payouts.
- A transactional email service sends booking messages.
- An SMS service verifies phone numbers before the first review.

Public provider pages should be server rendered where useful for search and social sharing. Sensitive changes happen on the server; the browser never receives privileged database access.

Background work is required to expire abandoned payment holds, complete past bookings, retry messages and reconcile delayed payment or refund events.

We are not building a generic database layer. The realistic portability goal is moving from Supabase Postgres to another Postgres host, not replacing PostgreSQL with any database.

---

## Non-negotiable safety rules

- Exact addresses remain private until a confirmed booking exists.
- Customers can see only their own bookings.
- Providers can see only bookings for their own page.
- Payment state comes from verified payment events, not a browser redirect.
- Money is stored as integer pennies, never floating-point numbers.
- Times are stored unambiguously and respect UK daylight-saving changes.
- The database prevents overlapping confirmed bookings.
- Uploads validate file type and size.
- Refund and administrator actions are recorded.
- Terms, privacy information and retention rules exist before real bookings begin.

---

## What success looks like

The MVP works when these journeys work end to end:

### A provider publishes

The provider signs in, creates their profile, sets one active location and working hours, adds a service, chooses booking rules, connects payments and publishes at `/@[username]`.

### A customer books with a deposit

The customer finds the provider, chooses a treatment and add-ons, sees only times that fit, pays the fixed deposit, receives immediate confirmation and sees the exact address. The provider sees the booking and offline balance.

### A customer books with full payment

The customer pays the full amount. Ceaute records processing, commission and provider amounts, confirms the booking and prevents another customer taking the same time.

### A customer cancels

Ceaute uses the stored deadline and policy. An early cancellation receives a full refund. A late cancellation keeps no more than the stored commitment amount.

### A provider cancels

The customer receives everything they paid, the time reopens and both parties are notified.

### A customer reviews

After the appointment, the customer verifies their phone once and leaves one review tied to the completed booking.

### A provider moves

The public page and new bookings use the new active location. Existing bookings keep their original address.

---

## Explicitly outside the MVP

- Teams, staff and salon-resource scheduling.
- Several published locations at once.
- Customer location selection.
- Mobile, home-visit or virtual services.
- Split shifts and one-off partial-day hours.
- Manual booking approval.
- Monthly slot releases.
- Native rescheduling and waitlists.
- No-show and lateness enforcement.
- Custom booking questionnaires.
- Recurring appointments, packages and memberships.
- Coupons, gift cards and product sales.
- Video portfolios and social-media importing.
- Direct messaging.
- External calendar synchronisation.
- Advanced analytics.
- Native mobile apps.
- Multi-currency and markets outside the UK.

These are exclusions, not forgotten requirements. We add them only when real usage shows that the core booking loop cannot work without them.

---

## Assumptions we will test after launch

These decisions do not block implementation. They are starting assumptions that the product is designed to change safely.

| Assumption                  | MVP decision                                                                 | Evidence we will watch                                                         |
| --------------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Deposit calculation         | One fixed page-wide amount                                                   | Do providers repeatedly ask for percentages or different deposits per service? |
| Commission                  | Calculated from total booking value                                          | Does the fee make reasonable deposits too small or confusing?                  |
| Customer phone              | Required but not verified at checkout                                        | Do providers use it, and how often is it wrong?                                |
| Provider-cancellation costs | Customer gets a full refund; Ceaute absorbs unrecoverable costs during alpha | How often does this happen and what does it cost?                              |
| Rolling availability        | Fixed 60-day rolling window and fixed 24-hour minimum notice                  | Do providers need configurable booking windows or notice periods?              |

The rule is simple: configuration may change, but a completed booking never changes underneath the people who made it.

---

## Build order

Implementation should happen in vertical slices. Each slice should leave behind something understandable and testable.

1. **Provider presence** — account, provider setup, active location, treatments, policies and public page.
2. **Availability** — weekly hours, blocked dates, fixed 60-day window and overlap-safe slot generation.
3. **Booking** — customer account, contact details, temporary hold and confirmed booking without real money.
4. **Payments** — Stripe Connect, full payment, deposits, commission and immediate confirmation.
5. **Booking management** — customer/provider views, cancellation and refunds.
6. **Discovery and trust** — area/treatment search, phone verification and reviews.
7. **Operations and billing** — administrator controls, email reliability, subscription and commercial configuration.

The approved product specification becomes the source for GitHub issues. A ticket should describe one user-visible outcome, its rules and how we know it works. Low-level database or framework work belongs inside the ticket only when it is necessary to deliver that outcome.
