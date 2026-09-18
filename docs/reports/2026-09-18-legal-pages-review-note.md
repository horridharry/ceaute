# Legal pages: sources, assumptions and unresolved owner decisions

Date: 18 September 2026. Branch: `chore/finalise-legal-pages`.

This note is the internal record behind `/terms` and `/privacy`. It exists so
that facts Ceaute has not established stay here, in a dated report, instead of
appearing on the public site as confident legal text. Read it before changing
either page.

**Status: neither page is final.** Two facts required by law are missing (see
[Unresolved owner decisions](#unresolved-owner-decisions)). Both pages
therefore keep the `draft` notice on `LegalPage`, and neither should be
described to a user, an investor or a provider as an approved policy until
that notice can be removed honestly.

## What the pages are based on

Coverage was established from official UK guidance, then checked line by line
against this repository. Where guidance and implementation disagreed, the
implementation won and the text describes what the code actually does.

### Official sources

| Source | Used for |
| --- | --- |
| [ICO, what privacy information should we provide](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/individual-rights/the-right-to-be-informed/what-privacy-information-should-we-provide/) | Article 13 coverage checklist |
| [ICO, right to be informed checklists](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/individual-rights/the-right-to-be-informed/checklists/) | Completeness check |
| [ICO privacy notice generator, general business](https://ico.org.uk/for-organisations/advice-for-small-organisations/privacy-notices-and-cookies/create-your-own-privacy-notice/privacy-notice-generator-for-customers-or-suppliers/general-business-including-retail-and-manufacture/generated-privacy-notice-general-business/) | Primary drafting framework and section order for `/privacy` |
| [ICO, controllers and processors](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/controllers-and-processors/controllers-and-processors/what-are-controllers-and-processors/) and [joint controllers](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/controllers-and-processors/controllers-and-processors/what-does-it-mean-if-you-are-joint-controllers/) | Ceaute/provider role split |
| [ICO data protection fee](https://ico.org.uk/for-organisations/data-protection-fee/) and [exemptions](https://ico.org.uk/for-organisations/data-protection-fee/data-protection-fee/exemptions/) | Owner action below |
| [GOV.UK, online and distance selling for businesses](https://www.gov.uk/online-and-distance-selling-for-businesses) | Distance-selling duties |
| [CCR 2013 reg 13](https://www.legislation.gov.uk/uksi/2013/3134/regulation/13), [reg 28](https://www.legislation.gov.uk/uksi/2013/3134/regulation/28), [reg 36](https://www.legislation.gov.uk/uksi/2013/3134/regulation/36), [Schedule 2](https://www.legislation.gov.uk/uksi/2013/3134/schedule/2) | Pre-contract information and the cancellation right |
| [BIS implementing guidance, December 2013](https://assets.publishing.service.gov.uk/government/uploads/system/uploads/attachment_data/file/429300/bis-13-1368-consumer-contracts-information-cancellation-and-additional-payments-regulations-guidance.pdf) | Intent behind reg 28(1)(h) |
| [Business Companion, distance sales](https://www.businesscompanion.info/en/quick-guides/distance-sales/consumer-contracts-distance-sales) | Trading Standards reading of the same exemption |
| [Consumer Rights Act 2015, Part 1 Chapter 4](https://www.legislation.gov.uk/ukpga/2015/15/part/1/chapter/4) | Services: reasonable care and skill, s.50 binding statements, s.57 no exclusion |
| [CMA207, unfair commercial practices (DMCCA 2024)](https://www.gov.uk/government/publications/unfair-commercial-practices-cma207/unfair-commercial-practices) | Drip pricing, fake reviews, platform duties |
| [E-Commerce Regulations 2002 reg 6](https://www.legislation.gov.uk/uksi/2002/2013/regulation/6) | Required website disclosures |
| [Company, LLP and Business (Names and Trading Disclosures) Regulations 2015, Part 6](https://www.legislation.gov.uk/uksi/2015/17/part/6/made) | Company name, number, registered office on a website |
| [Stripe UK privacy policy](https://stripe.com/gb/privacy), [Stripe DPA](https://stripe.com/legal/dpa), [Connect charges](https://docs.stripe.com/connect/charges), [Stripe security](https://docs.stripe.com/security) | Accurate description of Stripe's role and the money flow |

### Competitor references

Read for **topic coverage and presentation conventions only**. No wording was
copied, and none of their contractual arrangements were assumed to apply to
Ceaute.

- Fresha: [Terms of Service](https://terms.fresha.com/terms-service),
  [Terms of Use](https://terms.fresha.com/terms-use),
  [Partner Terms](https://terms.fresha.com/partner-terms),
  [Privacy Policy](https://terms.fresha.com/privacy-policy).
- Booksy: [Customer Terms](https://booksy.com/en-gb/p/terms),
  [Privacy Policy](https://booksy.com/en-gb/p/privacy),
  [Information Obligation](https://booksy.com/en-gb/p/information-obligation).

What was taken: the convention of stating the intermediary position early and
reinforcing it structurally (Booksy separates platform complaints from
provider complaints, and Ceaute's Terms now do the same); presenting
cancellation as the provider's policy surfaced before confirmation, never as
the platform's; and giving reviews their own section.

What was deliberately **not** taken:

- **Fresha's commercial-agent characterisation.** Ceaute has no agency
  agreement with providers and none is asserted.
- **Fresha's and Booksy's liability-exclusion sections.** Ceaute excludes
  nothing; CRA 2015 s.57 forbids excluding the s.49 duty anyway, and an
  unnegotiated exclusion is a liability, not an asset.
- **Platform and service fees.** `calculateCeauteFeePence` returns `0`. The
  Terms say Ceaute adds no fee, because it does not.
- **Vouchers, gift cards, promo codes, subscriptions, saved cards, no-show
  fees, rescheduling, provider replies to reviews.** None exist in the MVP.
- Neither competitor gives address disclosure its own section. Ceaute does,
  because the private-address invariant is enforced in PostgreSQL and is a
  genuine product promise.

## Vendor arrangements as verified

Checked against each vendor's own live documentation on 18 September 2026,
rather than taken from a generator. The findings below are why `/privacy`
names specific companies and specific behaviour instead of "our trusted
partners".

| Vendor | Legal entity | Role toward Ceaute | Verified source |
| --- | --- | --- | --- |
| Stripe | Ambiguous — see below | **Both**: processor for the payment instruction, **independent controller** for fraud, financial-crime and AML purposes | [Privacy policy](https://stripe.com/privacy), [DPA](https://stripe.com/legal/dpa) |
| Supabase | Supabase Pte. Ltd., Singapore | Processor for project data; controller for Ceaute's own account data | [DPA](https://supabase.com/legal/dpa), [privacy policy](https://supabase.com/privacy) |
| Resend | Plus Five Five, Inc., San Francisco | Processor for email content and recipients | [DPA](https://resend.com/legal/dpa), [GDPR page](https://resend.com/security/gdpr) |
| Vercel | Vercel Inc., Delaware | Processor for data passing through the hosted app | [DPA](https://vercel.com/legal/dpa), [privacy notice](https://vercel.com/legal/privacy-policy) |

Facts that changed the drafting:

- **Stripe is not simply "our processor."** Its DPA gives it "sole and
  exclusive authority to determine the purposes and means" for the data it
  processes as a controller, covering fraud detection, AML and regulatory
  compliance. Describing it flatly as a processor — the most common error in
  UK privacy notices — would be wrong on Stripe's own terms. `/privacy` states
  the split.
- **Stripe Connect Express collects provider KYC directly.** Stripe's Express
  documentation confirms Stripe handles identity verification, and that a
  platform "can't read or update its KYC information" after creating an
  account link. Ceaute receives only the account id, capability statuses and
  the *names* of outstanding requirement fields — verified against
  `202609111954_update_provider_payment_accounts_for_stripe_accounts_v2.sql`,
  which stores exactly that. The Terms say Stripe collects it, because it
  does.
- **Resend stores everything in the US, whichever region sends the message.**
  Its regions documentation is explicit that region selection controls routing
  only and that "all account data, including email metadata, logs, and API
  records, is stored in the United States". A notice implying EU email
  residency would be false. Retention is 30 days on all plans; account
  termination deletes within 90 days.
- **Supabase project region is genuine data residency** for the primary
  database, but Supabase warns it is "a data-location control, not proof of
  regulatory compliance", and the general region groupings do not map to a
  jurisdiction. Supabase publishes no location data for its sub-processors.
- **Vercel does not commit to where logs are stored.** Neither its regions
  documentation nor its function-region documentation says anything about log
  storage, so `dub1`/`lhr1` execution regions prove nothing about log
  residency and `/privacy` does not claim otherwise. Runtime log retention is
  1 hour on Hobby and 1 day on Pro.
- **Transfer safeguard is consistent across all four**: EU standard
  contractual clauses plus the ICO's UK Addendum, with some vendors also
  relying on the UK extension to the EU-US Data Privacy Framework. It is *not*
  the standalone IDTA and it is not adequacy. `/privacy` says so.

Three vendor facts could **not** be verified and are therefore not asserted
anywhere on the public pages:

1. **Which Stripe entity is Ceaute's counterparty.** Stripe's Services
   Agreement, DPA, Privacy Center and complaints page give three different
   answers (Stripe Payments Europe Limited, Stripe Technology Company Limited,
   Stripe Payments UK Ltd). Stripe publishes no registered addresses or
   company numbers on those pages. Check the signed Stripe Financial Services
   Terms before naming one.
2. **The Supabase project region for `ceaute-prod`.** Not recorded in this
   repository and not exposed by the project's HTTP headers. `/privacy`
   therefore says data is stored "in the cloud region we selected" rather than
   naming a country. Confirm it in the Supabase dashboard and publish it —
   it should be `eu-west-2` (London), and if it is a "general" region grouping
   it should be moved to a specific one.
3. **Whether Vercel's DPA applies to Ceaute's plan.** Vercel's DPA language
   references Enterprise and Pro. `/privacy` describes Vercel as acting on our
   instructions, which is only true if the DPA is in force. Confirm the plan.

## Material legal assumptions

1. **Ceaute and the provider are separate, independent controllers — not joint
   controllers and not controller/processor.** The purposes differ: Ceaute
   operates a marketplace, the provider delivers and records a treatment. The
   ICO's test is that controllers processing the same data for *different*
   purposes are separate controllers. This is an applied analysis; the ICO
   publishes no marketplace worked example. The Terms and the Privacy notice
   state the same split, and they must be changed together.
2. **Stripe is a processor for some activities and an independent controller
   for others** (fraud prevention, financial-crime and AML compliance). The
   Privacy notice says exactly this. Describing Stripe flatly as "our
   processor" would be wrong on Stripe's own published terms.
3. **Ceaute holds no card data whatsoever.** Verified against
   `202609120001_create_booking_payment_attempts.sql`: the table stores Stripe
   identifiers, amounts, currency and status, and not even a card last-four or
   brand. The Privacy notice claims no more than that.
4. **Destination charges mean Ceaute is charged first.** `docs/product.md`
   records a destination charge transferring to the provider's connected
   account. Under Stripe's model the platform's balance bears refunds and
   chargebacks, so the Terms say payment "is taken through Stripe and
   transferred to the provider's own Stripe account" rather than claiming the
   provider takes payment directly. See item 4 under owner decisions.
5. **Retention.** Booking, payment and refund records are kept six years after
   the appointment; this is a decision recorded here, matching the HMRC
   business-record requirement and the Limitation Act 1980 claim window.
   Account and profile data are kept until deletion is requested; reviews are
   kept while the provider page is published. **Nothing in the codebase
   enforces any of this** — there is no deletion job, no retention job and no
   account-closure flow. The Privacy notice states the policy; the product
   does not yet implement it. See item 5 under owner decisions.
6. **Governing law is England and Wales**, with the consumer's own local
   courts preserved. Confirmed by the owner on 18 September 2026.
7. **UK-only service.** GBP-only (`currency = 'gbp'` check), UK phone
   normalisation, `country_code = 'GB'` on `provider_location`,
   `identity_country = 'GB'` on `provider_payment_account`, `Europe/London`
   throughout. The pages assume UK customers and UK providers.

## The reg 28(1)(h) question — unresolved and material

CCR 2013 reg 28(1)(h) removes the 14-day distance-selling cancellation right
for "services related to leisure activities" where the contract provides for a
specific date or period of performance. If it covers a beauty appointment,
Ceaute's provider-set cancellation windows sit comfortably within the law. If
it does not, a customer may have a statutory 14-day right that the
cancellation window does not reflect.

**No authoritative UK source confirms that a beauty treatment is a "leisure
activity."** BIS's rationale — protecting a trader who has set aside capacity
they may not be able to resell — fits an appointment exactly, but its examples
are car hire, wedding venues and theatre tickets, and Trading Standards'
examples are hotels, couriers, car hire, restaurants and theatres. None names
beauty, hairdressing or personal care.

Options, in order of preference:

1. **Put it to a solicitor.** This is the single item in the whole legal
   review most worth paid advice.
2. **Build the reg 36 mechanism** — an express request to begin performance
   within the cancellation period plus an acknowledgement that the right is
   lost on full performance. This makes the commercial outcome the same
   whichever way reg 28(1)(h) falls. It needs a checkbox at checkout and a
   line in the confirmation email; it is a product change and was deliberately
   **not** made as part of this legal-only work.

Until one of those happens, `/terms` says what is true: the booking is for a
specific date and time, the provider's window describes what Ceaute refunds in
practice, statutory rights are not excluded, and Ceaute has not yet taken
advice on how the regulations apply. It does not assert the exemption, and it
does not invent a cancellation right the product does not honour.

## Other compliance gaps found, not fixed here

These were found while checking the pages against the implementation. None is
a legal-text problem, so none was changed in this branch.

1. **Provider trading identity is not disclosed before purchase.** CCR 2013
   Schedule 2 (b)–(e) requires the identity and geographic address of the
   trader, and of any trader on whose behalf an intermediary acts, before the
   consumer is bound. Checkout shows the provider's display name, username and
   public area — not a trading name, legal identity or complaints address. The
   exact address is correctly withheld until payment (that is the point of the
   privacy invariant), but a complaints route to the provider is a separate
   thing and is currently missing. Booksy solves this by putting the data
   needed to make a complaint on the provider profile.
2. **No durable-medium check on the full Schedule 2 set.** Reg 16 requires
   confirmation of the pre-contract information on a durable medium by the
   time performance begins. The confirmation email via Resend is that durable
   medium and was not audited field by field against Schedule 2 in this pass.
3. **No account deletion or data export.** Rights requests must be handled
   manually, and there is no contact address to receive one (see below).
4. **No cookie banner, correctly.** Only session and booking cookies are set;
   there is no analytics, advertising or marketing tooling in
   `package.json`. If any is added, `/privacy` and the banner position must
   change together.
5. **Review moderation is backend-only.** `create_booking_review` and the
   visibility function exist; no screen calls the hide/show function. The
   Terms say Ceaute can hide a review, which the system supports, but there is
   no operational process behind it. DMCCA 2024 makes fake reviews a banned
   practice and expects reasonable and proportionate steps — verified-booking-
   only reviews is a good start and is worth stating publicly, which the Terms
   now do.

## Unresolved owner decisions

The first two block calling either page final.

1. **The legal entity operating Ceaute.** Not established as of 18 September
   2026 (owner confirmed). Blocks: the trader identity required by CCR 2013
   Schedule 2(b), the name, geographic address, registration number and VAT
   number required by E-Commerce Regulations 2002 reg 6, the registered name,
   place of registration, company number and registered office required on a
   website by the 2015 Trading Disclosures Regulations if it is a company, and
   the controller identity required by UK GDPR Article 13(1)(a). Nothing may
   be invented in its place. Once settled, add it to both pages and to a
   footer.
2. **A monitored contact address.** None exists (owner confirmed).
   `bookings@ceaute.com` is the outbound Resend sender and the Supabase admin
   address; there is no evidence it receives inbound mail. Blocks: the contact
   details required by Article 13(1)(a), a route for data-subject rights
   requests, the complaints-handling policy required by Schedule 2(k), and the
   rapid-and-direct email contact required by reg 6. Both pages currently
   direct alpha users to the address the Ceaute team gave them at invitation,
   which is true but is not a published contact route.
3. **ICO data protection fee.** Ceaute must pay the annual fee under the Data
   Protection (Charges and Information) Regulations 2018 — running a booking
   marketplace matches no exemption. Tier 1 applies at this size (£52, £47 by
   direct debit). Cannot be registered before the operating entity exists. The
   ICO flags several fee pages as under review following the Data (Use and
   Access) Act 2025, so re-check the amount at the time.
4. **Who bears refunds and chargebacks between Ceaute and the provider.** With
   destination charges, Stripe debits the platform's balance, not the
   provider's. Ceaute has no provider agreement giving it a right to reverse a
   transfer or set off against a future payout. The Terms do not claim one.
   This is a commercial exposure, not a drafting problem.
5. **Whether to implement the stated retention.** Six years is now written on
   `/privacy`. There is no job that deletes anything and no account-closure
   flow. Either build them or accept that retention is manual and
   undocumented.
6. **Confirm the three vendor facts above** — the Stripe contracting entity,
   the Supabase production region, and whether Vercel's DPA covers the current
   plan. Each is a one-look check in the relevant dashboard, and each is
   currently a sentence `/privacy` cannot make as specific as it should be.
7. **Provider terms as a separate document.** Both competitors separate
   customer terms from provider terms. Ceaute's single Terms page covers both
   sides in two sections. That is adequate at alpha scale and becomes
   unsatisfactory as soon as providers are onboarded at volume or a provider
   agreement needs commercial clauses (transfer reversal, set-off,
   suspension).
