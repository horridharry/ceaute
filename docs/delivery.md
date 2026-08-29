# Ceaute MVP delivery plan

This plan turns the product specification into a build order that one developer can understand and follow.

The goal is not to describe every technical task in advance. The goal is to make the product behaviour clear enough that a developerâ€”or an AI working with that developerâ€”can implement it without guessing what Ceaute is meant to do.

## How we will manage the work

Create one GitHub Project called **Ceaute MVP**.

Use the default columns:

- Todo
- In progress
- Done

Do not add phases, priorities, estimates, story points or dependency fields. The issue order already tells us what comes first. With one developer, those fields create maintenance work without improving decisions.

Use only two additional labels:

- `blocked` â€” work cannot continue because a decision or external dependency is missing.
- `bug` â€” existing behaviour does not work as agreed.

Everything else is normal MVP work and does not need a label.

## What a good ticket should contain

Every ticket should answer three questions:

1. Why does this matter to the user?
2. What behaviour are we building?
3. How will we know it works?

Database, server and interface work belong inside the ticket that needs them. We should not create separate frontend, backend or database queues because Ceaute only gains value when the complete user journey works.

Technical detail should appear only when it protects an important product rule. Examples include preventing double bookings, keeping exact addresses private and avoiding duplicate charges.

---

## 1. Sign in and save a provider draft

Providers need to start setting up Ceaute without completing everything in one sitting.

### Build

- Passwordless email sign-in.
- A Ceaute profile linked to the signed-in account.
- One provider page per account.
- Provider setup that saves as a draft and can be resumed.
- Ownership rules that prevent another account from viewing or editing the draft.

### Done when

- A new user can sign in and begin provider setup.
- Their progress remains after signing out and returning.
- The same account cannot create a second provider page.
- Another account cannot access the draft.

---

## 2. Create and preview a provider page

A provider needs one place to explain who they are, what they offer and how their business works.

### Build

- Username, display name, category and biography.
- One active location with a public area and private exact address.
- Portfolio images.
- Provider treatment groups, treatments and compatible add-ons.
- Prices, durations and display order.
- Full-payment or fixed-deposit settings.
- Cancellation window and written policies.
- A preview of the future public page.

### Done when

- A provider can create a complete page and return later to edit it.
- The preview shows their public area, treatments, add-ons, portfolio and policies.
- The preview never reveals the exact address or access instructions.
- Treatments and policies already used by bookings are archived or versioned rather than overwritten.

---

## 3. Set working hours and show available times

Providers need to control when they work. Customers should see only times that can actually fit their appointment.

### Build

- One working period for each enabled weekday.
- Whole dates that can be blocked.
- A rolling 30, 60 or 90-day booking window.
- A fixed 24-hour minimum notice.
- Available times calculated from working hours, existing bookings and the duration of the selected treatment and add-ons.

### Done when

- A provider can set and change their working week.
- A customer sees starts every 15 minutes during bookable hours.
- An appointment cannot run beyond closing time.
- Blocked dates and occupied periods are unavailable.
- Times remain correct when UK daylight-saving time changes.

---

## 4. Complete a booking in test mode

Before introducing real money, we need to prove the complete booking agreement and prevent two customers from taking the same time.

### Build

- Treatment and add-on selection.
- Date and time selection.
- Customer sign-in, full name and phone number.
- Checkout summary showing price, payment terms, cancellation terms and public area.
- A ten-minute booking hold while checkout is active.
- A non-production confirmation path.
- A booking snapshot containing the service, location, policy, time and money agreed at checkout.

### Done when

- A customer can complete the journey from provider page to confirmed test booking.
- Two customers cannot hold or confirm overlapping appointments.
- Abandoned holds expire and release the time.
- A confirmed booking cannot change when the provider later edits a treatment, policy or address.
- Only the customer and provider can see the exact address after confirmation.

---

## 5. Connect Stripe and publish the provider page

A provider should become publicly bookable only when their page and payment account are ready.

### Build

- Stripe Connect onboarding that can be resumed.
- Stripe capability status updated from verified events.
- One server-side publish action.
- Public provider pages at `/@[username]`.

### Done when

- A provider can complete or resume Stripe onboarding.
- Publishing is refused until their profile, active location, working hours, treatment, policy and Stripe account are ready.
- A published page is publicly visible and bookable.
- Draft or suspended pages are not publicly bookable.
- Duplicate or forged Stripe events cannot change provider state.

---

## 6. Take full payments and fixed deposits

Customers need to pay the correct amount, and providers need a reliable confirmed booking.

### Build

- Full payment at checkout.
- A provider-wide fixed deposit with the remaining balance shown as due at the appointment.
- Ceaute commission calculated from the total booking value.
- Confirmation from verified Stripe events rather than the browser redirect.
- Stored payment attempts and final booking amounts.

### Done when

- Full-payment bookings collect the complete price.
- Deposit bookings clearly show the total, paid now and due later.
- A successful Stripe event confirms the booking once.
- Failed or abandoned payments release the appointment.
- Retried or duplicate events cannot create duplicate charges or confirmations.
- Previous bookings keep their original prices, fees and payment terms after provider settings change.

---

## 7. View and cancel bookings

Customers and providers need to understand what is booked and what happens when either party cancels.

### Build

- Upcoming, completed and cancelled booking lists for customers and providers.
- Automatic completion after an appointment ends.
- Customer cancellation using the policy stored with the booking.
- Provider cancellation with a full refund.
- Refund progress and failure states.
- Essential confirmation and cancellation emails.

### Done when

- Each person can see only bookings they are allowed to access.
- Booking history displays the original booking details rather than the provider's latest settings.
- Early customer cancellation refunds everything paid online.
- Late cancellation retains only the agreed fixed commitment.
- Provider cancellation refunds everything paid online and releases the time.
- Repeating a cancellation, refund or email job does not duplicate its effect.

---

## 8. Find providers by area and treatment

Customers need a simple way to discover relevant, currently bookable providers.

### Build

- Search by area and treatment.
- Results containing published providers whose active location and active treatments match.
- Links from results to the provider page.

### Done when

- Draft, suspended and inactive providers never appear.
- Results reveal only public location information.
- Standard discovery categories provide consistent matches even when providers organise or name their menus differently.
- There is no paid ranking, personalisation or distance calculation in the MVP.

---

## 9. Leave a verified review

Reviews should prove that the customer completed a real Ceaute booking.

### Build

- SMS phone verification before the customer's first review.
- One rating and optional comment per completed booking.
- Public reviews on the provider page.
- A way for Ceaute to hide a review without deleting its history.

### Done when

- Only the customer attached to a completed booking can review it.
- One booking cannot create multiple reviews.
- Verification codes expire and repeated requests are limited.
- Providers cannot remove reviews themselves.
- Hidden reviews disappear publicly but remain available for support and audit purposes.

---

## 10. Open the private alpha safely

Before accepting real bookings, we need to prove the complete loop and know how to respond when something fails.

### Build

- End-to-end checks for provider setup, publication, booking, payment, cancellation, refund and review.
- Error monitoring and production backups.
- A short operator runbook for failed payments, refunds, emails, account suspension and incidents.
- Terms and privacy information appropriate for the alpha.
- Zero subscription and commission defaults unless an alpha provider is deliberately configured otherwise.

Use Stripe and Supabase's existing dashboards for alpha support. Do not build a custom Ceaute administration system until repeated real support work shows exactly what it needs to do.

### Done when

- One real provider and one test customer can complete every core journey in a production-like environment.
- Exact addresses are absent from public pages, metadata, logs and unauthorised responses.
- Money uses integer pennies and reconciles with Stripe records.
- Payment, refund, webhook and email retries are safe.
- Production secrets, webhook verification, backups and monitoring are configured.
- Live payments stay disabled until the launch checks pass.

---

## Build order

Work through the issues in numerical order.

The first seven create the commercial loop:

> Provider sets up â†’ publishes â†’ customer books â†’ customer pays â†’ both parties manage the booking.

Search and reviews follow because they depend on real published providers and completed bookings. The final ticket turns the working product into a supportable private alpha.

This order replaces phases, priorities and a dependency graph. If an issue becomes blocked, apply the `blocked` label, record the reason in one comment and continue only with work that does not depend on it.

## Explicitly deferred

The MVP does not include:

- A custom administration dashboard.
- Subscription billing during the private alpha.
- Multiple locations or scheduled location changes.
- Native rescheduling.
- No-show and lateness enforcement.
- Custom booking questionnaires.
- External calendar synchronisation.
- Teams or staff accounts.
- Product sales, vouchers, coupons or loyalty schemes.
- Advanced analytics, ranking or recommendations.
- Reminder and marketing messages.

These are not forgotten requirements. They are ideas that should earn their way into the product through observed provider or customer behaviour.
