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
7. Policies

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

Decided 23 September 2026 by the product owner: Book opens the full Treatment
details sheet for every Treatment, so the customer reads the full description,
duration, price and Add-ons before choosing a time.

Book
→ Treatment details (with Add-on selection where available)
→ Choose time

## Reviews

Show a maximum of three reviews on the main provider page.

Provide an action such as:

- See all reviews
- Show all reviews

The exact label can be determined during UI design.

The complete Reviews experience allows the customer to scroll through all reviews.

Reviews should be sorted most recent first unless product direction changes.

## Availability

Decided 27 September 2026 by the product owner (`docs/decisions/007-availability-released-in-drops.md`): the page says what is open for booking and when the next drop opens, for example "October slots are open for booking" and "November slots open on 15 October at 7 pm" (wording revised the same day, see below). Providers no longer have weekly opening hours, so the page does not show them. It never shows the dates of a drop before its drop time.

Also decided 27 September 2026: customers read "slots", "open for booking" and "open on"; "drop" and "drop time" are words for providers only. "Slots" was added after the first local test (decision 007, Words). Drop times are written like hours: "15 October at 7 pm". With several open drops the page names each one, using the names in provider-experience.md (Availability). With nothing open and nothing coming, the section is left out, as it is today when a provider has no open days. While a page is paused, the section is also left out, so it never says "open for booking" beside "isn't taking online bookings right now".

This is customer-readable availability information rather than provider editing controls.

## Policies

Decided 27 September 2026 by the product owner: a Policies section below Availability, so a customer can read the rules before choosing a Treatment. It shows the terms Ceaute writes from Booking Settings (the deposit or full payment, the cancellation window and what a late cancellation keeps), then the provider's house rules under their headings. Review and pay and the held page keep showing the same terms and house rules.

How a long set of rules is shortened on the page is UNDECIDED (see `undecided.md`). For now it is one section.

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

When nothing is open, say when the next drop opens instead of showing closed days. At the drop time the dates appear without the customer reloading (decided 27 September 2026, decision 007).

Also decided 27 September 2026 by the product owner:

- The day strip shows only dates the provider has opened, and the month heading follows the dates shown. If a provider opens 3, 10 and 17 November, the strip shows those three. A date with no free start left says "Full". The first date with a free start is selected.
- When no free start remains, because nothing is open or everything open is full, the screen also says when the next drop opens, above any "Full" dates: for example "December slots open on 15 November at 7 pm".
- With nothing open, the screen says "No dates are open. November slots open on 15 October at 7 pm." With nothing open and nothing coming, it says "No dates are open for booking right now."
- An open date where the chosen Treatment, with its Add-ons, fits at no start keeps today's "No times" label and its message, "There isn't a long enough gap for this booking on …".
- Booking times stay 24-hour, as today.

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

Customer pays the provider's deposit: a flat amount or a percentage (`docs/decisions/008-flat-deposit.md`).

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
