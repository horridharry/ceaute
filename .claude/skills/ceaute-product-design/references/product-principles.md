# Ceaute Product Principles

## 1. Easy beats clever

Ceaute's advantage should come from being easy to understand and use.

Do not introduce novelty merely to make the product appear sophisticated.

A provider should generally understand what to do without needing to learn Ceaute.

## 2. Model the provider's business, not the software

Providers think about:

- what they offer
- when they work
- where they work
- who has booked
- how customers pay
- how their work appears publicly

Design around those concepts.

Do not expose database relationships or technical architecture as product structure.

## 3. Progressive disclosure

Show enough to understand and act.

Reveal depth when requested.

Examples:

- Portfolio preview → masonry portfolio → individual image
- Treatment preview → all Treatments → Treatment detail
- Review preview → all Reviews
- Availability weekday summary → expanded editing controls

Progressive disclosure is not the same as hiding important information.

Information required for a decision must still be visible before the decision is committed.

## 4. Recognition before interaction

Management screens should first help providers understand their current state.

Editing controls can appear when the provider chooses to change something.

Availability is a strong example:

`Monday — 9 am to 5 pm`

is easier to scan than immediately presenting switches, time selectors and labels for every weekday.

## 5. Avoid unnecessary steps

Do not force users through a screen when there is no decision to make there.

Example:

If a Treatment has no Add-ons:

`Book → Choose time`

If a Treatment has Add-ons:

`Book → choose Add-on(s) → Choose time`

The Treatment detail experience can still exist for customers who intentionally inspect the Treatment.

## 6. Context determines useful information

Do not display a field merely because Ceaute has it.

A provider's booking summary needs information useful for servicing the appointment.

A payment ledger is not automatically useful there.

Likewise, provider Home needs the immediate working schedule, not every metric Ceaute can calculate.

## 7. Readiness and publication are separate

Completing the requirements to operate makes a provider ready to publish.

It does not automatically publish them.

Going live must be an intentional provider action.

## 8. Optional means optional

Do not manufacture completion pressure around optional information.

Do not create arbitrary "100% complete" states that make optional fields feel mandatory.

For example, display photo and bio improve a provider's public presence but do not currently block publication.

## 9. Privacy follows necessity

Collect precise information where required but expose only the precision currently needed.

For provider locations:

- Ceaute needs the exact address.
- Before a paid booking, customers need only the public location such as city.
- The exact booking address becomes available after payment.

## 10. Independent sections can interact

Product independence does not mean isolation.

A provider can create a Treatment Group from the Treatment creation journey because it solves the task they are currently performing.

The underlying sections still have independent management experiences.

## 11. Don't optimise for theoretical consistency

Treatments and Add-ons do not need identical list interfaces.

Customer discovery and provider management do not need identical card systems.

Choose the interface that best supports the task.

## 12. Positive moments can have more personality

Routine provider management should remain calm and operational.

High-value positive moments may carry more delight.

Booking confirmation is one such opportunity.

The exact celebratory interaction is not decided.

Do not default to confetti merely because it was discussed as an example.

## 13. Learn where evidence should decide

Some product decisions should remain adjustable until real usage provides evidence.

Do not turn an MVP choice into an immutable design principle merely because it shipped first.
