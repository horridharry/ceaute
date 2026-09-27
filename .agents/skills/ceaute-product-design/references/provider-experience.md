# Provider Experience

## Provider onboarding

A customer account can become a provider.

Initial provider onboarding should be deliberately small.

Initially collect:

- Business name
- Username

Do not force the provider through a large setup wizard before allowing them into the provider product.

After initial creation, setup happens progressively through the actual provider sections.

## Publication readiness

A provider needs the following before going live:

- at least one Treatment
- Location
- Availability: at least one date from today on with times, even if its drop has not opened
- Payments configured
- provider/business Category

Every Treatment belongs to a Treatment Group, so a Group will necessarily exist when a Treatment exists.

Optional:

- Display photo
- Bio
- Portfolio
- Add-ons

Completing the requirements makes the provider ready.

Ceaute must not automatically publish them.

Publication requires an intentional provider action.

For a new provider, Home may temporarily show a setup/readiness checklist.

This is not a sequential wizard.

Checklist items should take the provider to the relevant independent section.

## Home / Today

Provider Home is not an analytics dashboard.

It is the provider's working home.

Primary hierarchy:

1. Today's bookings
2. Upcoming bookings

Today's bookings are chronological.

If there are no bookings today, clearly say so.

Upcoming shows a maximum of three future bookings, ordered by date/time.

Provide an action to see all bookings.

A booking at a glance should expose useful operational information such as:

- time/date where relevant
- customer
- Treatment
- whether inspiration images are attached

Do not fill Home with revenue cards, analytics widgets or generic dashboard metrics merely because data exists.

## Provider booking detail

Booking detail helps the provider service the appointment.

Show:

- customer details
- Treatment details
- inspiration images
- amount paid
- for deposit bookings, amount paid online and amount remaining to collect

Relevant actions include:

- call customer
- inspect inspiration
- cancel booking

Tapping an inspiration image should allow the provider to inspect it at a useful size.

Payment presentation should be operational.

Prefer concepts such as:

- Paid online
- To collect

Do not turn this screen into a Stripe-style transaction ledger.

## Treatments

Treatments are organised by provider-created Treatment Groups.

The Treatments screen should show Treatment Groups and the Treatments belonging to them.

A Group can have:

- Name
- optional Description

When present, the Group description can provide context for the Treatments underneath it.

A Treatment list item/card should expose:

- Name
- Description
- Duration
- Price
- Add-on count where relevant

Selecting a Treatment goes directly to editing it.

Do not invent a read-only provider Treatment-detail screen unless a future need requires one.

Providers can edit and delete Treatments subject to product/data integrity rules.

### Finding Treatments

Providers can search Treatments by Treatment name.

Treatment Group pills can filter the screen.

Example:

`All groups | Braids | Natural hair | Locs`

These are provider-created Treatment Groups.

Do not reinterpret them as Ceaute-wide Treatment categories.

## Treatment Groups

Every Treatment must belong to a Treatment Group.

A Treatment Group has:

- Name — required
- Description — optional

When creating a Treatment, the provider can:

- select an existing Treatment Group
- create a new Treatment Group without abandoning the Treatment creation flow

Treatment Groups remain an independent provider-management area.

Do not create an umbrella "Catalogue" concept around Treatments, Groups and Add-ons.

## Add-ons

An Add-on has:

- Name — required
- Description — optional
- Additional price — required
- Additional duration — required

An Add-on can be linked to Treatments during creation/editing.

The Add-ons list should expose:

- Name
- Description
- number of linked Treatments

The MVP Add-ons screen does not require search or filtering.

Selecting an Add-on goes directly to edit.

Providers can delete an Add-on.

Deleting an Add-on must not delete linked Treatments.

## Locations

Ceaute's current market is the UK.

Country does not need to be an editable provider field in the MVP.

Location creation should make address entry easy.

The intended interaction is address autocomplete:

1. Provider starts typing an address.
2. Matching addresses appear.
3. Provider selects the correct address.
4. Ceaute stores the structured location information it needs.

Relevant address information includes:

- Address line 1
- Address line 2
- Town/City
- Postcode

A provider may give the Location an optional nickname, for example:

- Home
- University

The exact post-autocomplete correction/editing behaviour is UNDECIDED.

### Saved Locations

A provider can have a maximum of three saved Locations.

Exactly one is the current Primary Location for normal new bookings.

Primary means current.

It is not a preference ranking.

The Primary Location should appear first.

A Location entry can display:

- city
- country
- optional nickname

Providers can:

- select a Location to edit it
- delete eligible Locations
- make another Location Primary

Existing booking-integrity constraints must be respected.

### Location privacy

Before payment, customers should not see the provider's exact address.

Publicly expose only the location precision necessary to understand where the provider is based, such as city and country.

After payment, the customer can access the exact address associated with their confirmed booking.

The provider nickname is a provider-management aid, not a public substitute for location.

## Availability

Decided 27 September 2026 by the product owner
(`docs/decisions/007-availability-released-in-drops.md`): providers release
their time in drops. This replaces weekly hours and blocked dates. The current
weekly-hours screen is legacy until it is rebuilt.

The provider's task, done easily on a phone:

1. pick dates, usually in one month, by tapping them;
2. give the chosen dates their times together, then change single dates if needed;
3. choose when those dates drop: a date and a time, or now.

Each date has either:

- **hours**: one range, such as 10 am to 5 pm; Ceaute offers every start that fits
- **start times**: exact times, such as 10 am, 12 pm and 3 pm; only those are offered

Never both on one date. The provider never types individual 15-minute starts.

A **drop** is a group of dates with one **drop time**. Until the drop time nobody else can see or book those dates. A provider can have several drops, for example 1–14 November and 15–30 November. Ceaute names a drop by its dates; there is no name to type.

Everything stays editable after a drop opens: dates, times and the drop time. Moving the drop time later hides the dates again. Bookings already made never change.

There is no usual week and no blocked-dates list. A date without times is closed.

Do not turn the MVP into complex calendar-management software.

## Profile

Profile manages the provider's basic public identity.

Editable fields:

- Display photo
- Username
- Business name
- Bio
- Category

Display photo and Bio are optional for publication.

Category is required for publication.

Provider Category is distinct from Treatment Groups.

Do not merge these concepts.

## Portfolio

Portfolio is visual content management.

The provider's normal Portfolio management view can show a subset of up to six images.

The viewing hierarchy is:

small subset
→ View all
→ masonry layout
→ select image
→ larger individual image view

The full viewing experience should match the customer portfolio viewing experience.

Editing is intentional.

In Edit mode, the provider can:

- add images
- delete images

Do not cover the normal viewing experience with management controls merely because the viewer owns the Portfolio.

## Booking Settings

Booking Settings currently exposes two provider decisions.

### Payment requirement

Provider chooses:

- Full payment
- Deposit

If Deposit is selected, the provider sets a percentage of the Treatment price to be paid online.

Decided 27 September 2026 by the product owner (`docs/decisions/008-flat-deposit.md`): a Deposit is either a flat amount, one £ figure for the whole business, or a percentage. Flat is offered first and is the default. A late cancellation keeps the whole flat deposit. Full payment is unchanged.

### Cancellation window

Provider chooses free cancellation up to:

- 12 hours
- 24 hours
- 48 hours

Do not expose underlying refund-processing mechanics here.

The provider is choosing a business policy, not configuring payment infrastructure.

### House rules

Decided 27 September 2026 by the product owner: the one written-policy box becomes house rules under fixed headings that Ceaute sets, such as Guests, Lateness, Preparation, Aftercare and Other. Each heading is optional free text in the provider's own words. It is text only: Ceaute does not charge a late fee written there, and adds no tick box, because every booking already keeps a copy of what the customer saw.

Text in today's single written-policy box is not carried over: a provider starts their house rules afresh. Production has no providers, and bookings already made keep their copy.

This follows the rule that platform rules (money, time, access) stay standard and Ceaute enforces them, while the provider's own words fit inside a fixed structure.

## Payments

The MVP Payments section answers:

> Can Ceaute pay me?

Its purpose is Stripe connection/setup.

The provider should be able to understand whether their payment account is:

- set up and active
- not yet set up
- incomplete or otherwise requiring action, where supported by real integration state

Before setup, provide the action to connect with Stripe.

Once connected, provide appropriate status and management access.

Do not invent:

- revenue dashboards
- earnings charts
- transaction analytics
- payout-management interfaces

simply because the section is called Payments.

Revenue, earnings and payout functionality is a future direction, not current MVP scope.
