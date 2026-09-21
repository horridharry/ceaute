# Customer Experience

## Public provider page

The provider page should take the customer from visual impression to trust to bookable services.

The intended vertical information architecture is:

1. Hero imagery
2. Provider identity
3. Portfolio
4. Treatments
5. Reviews
6. Availability
7. Policies — future/not currently scheduled for MVP

Exact styling remains subject to design exploration.

## Hero

The first thing the customer sees is a wide visual hero.

For the MVP, the provider's first Portfolio image supplies the initial hero image.

The customer can move between the provider's images from the hero.

Selecting the imagery takes the customer into the full masonry Portfolio experience.

Do not introduce a separate provider cover-image management requirement for the MVP unless explicitly approved.

## Provider identity

Below the hero, show relevant provider identity information:

- Display photo, if supplied
- City
- Username
- Rating
- Bio

Do not create awkward empty placeholders for optional identity content.

## Portfolio

The provider page shows a small preview of the provider's work.

For the current MVP direction, the customer sees at most three preview images.

Provide a `See all X` style action where appropriate.

The complete viewing hierarchy is:

preview
→ masonry layout
→ individual image

The masonry and individual-image experience should match the provider's Portfolio viewing experience.

The preview count may later change from three to six based on real usage data.

Do not treat three as a permanent product principle.

## Treatments

Show up to three Treatments on the main provider page.

Provide an action to see all Treatments.

Selecting the Treatment itself opens its details.

The Book action should minimise unnecessary booking steps.

### Treatment without Add-ons

Book
→ Choose time

### Treatment with Add-ons

Book
→ Treatment/Add-on selection
→ Choose time

Do not force every customer through Treatment details when there is no booking decision to make there.

## Reviews

Show a maximum of three reviews on the main provider page.

Provide an action such as:

- See all reviews
- Show all reviews

The exact label can be determined during UI design.

The complete Reviews experience allows the customer to scroll through all reviews.

Reviews should be sorted most recent first unless product direction changes.

## Availability

The public provider page should expose the provider's normal opening hours.

This is customer-readable availability information rather than provider editing controls.

## Policies

A customer-facing Policies section is envisioned below Availability.

It is not currently scheduled for the MVP.

Do not implement it merely because its eventual page position has been discussed.

# Booking Journey

The intended booking journey is:

Treatment / Add-ons
→ Choose date and time
→ Review
→ Authenticate if necessary
→ Confirm and pay
→ Booking confirmed

## Choose date and time

The customer chooses a date and sees available times for that date.

They should be able to move through dates easily, including swiping where appropriate.

If the selected date has no availability, provide a clear way to go to the next available date.

The customer should not have to manually hunt through empty dates.

## Review

Before payment, show a clear booking summary.

Relevant information includes:

- provider
- date
- time
- Treatment
- selected Add-ons where applicable
- total price

The customer can upload inspiration images at this stage.

The Review screen is where the booking should become understandable as a complete appointment before commitment.

## Authentication

Booking requires an account.

If the customer is already authenticated, do not interrupt the journey.

If not:

Review
→ Sign in / create account
→ return to Review

Authentication is a requirement inside the booking journey.

It must not unnecessarily destroy or restart the journey.

Preserve the booking context across authentication, including the customer's selections.

## Confirm and Pay

For the MVP, the provider determines the payment mode.

### Full payment provider

Customer pays the full required amount.

### Deposit provider

Customer pays the provider's configured deposit percentage.

The customer does not currently choose between full payment and deposit.

Allowing the customer to choose among payment options enabled by the provider is a possible future feature.

The applicable cancellation policy should be available to read before payment is committed.

## Confirmation

Successful payment confirms the booking.

The customer should see a useful confirmation summary.

Do not simply dump them into a generic bookings list after payment.

Booking confirmation is an opportunity for tasteful delight.

The exact celebratory interaction is UNDECIDED.

Do not assume confetti.

## Inspiration after booking

Customers can continue adding/removing inspiration images after confirmation until the appointment begins.

Once the appointment starts, inspiration becomes read-only.

Providers can view inspiration but do not manage the customer's images.
