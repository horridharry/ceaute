import { LegalPage, Todo } from "../_components/legal-page";

export const metadata = {
  title: "Privacy · Ceaute",
};

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy"
      summary="How Ceaute handles personal information."
      updated="18 September 2026"
      draft
    >
      <section>
        <h2>Who controls your data</h2>
        <p>
          Ceaute operates this booking platform and decides how the personal
          information described in this notice is used.
        </p>
        <Todo>
          The registered legal entity name, company number, and registered
          address that should appear here as the data controller are not yet
          set, and a privacy contact address does not exist yet either.
        </Todo>
      </section>

      <section>
        <h2>Information we collect</h2>
        <ul>
          <li>
            <strong>Account:</strong> your email address, used to sign you in
            with a one-time code. Supabase, our authentication provider,
            sends and checks the code.
          </li>
          <li>
            <strong>Profile:</strong> your name and phone number, if you add
            them.
          </li>
          <li>
            <strong>Bookings:</strong> for each booking, your contact
            details, the treatment, price, and appointment time, and — once
            you have paid — the provider&rsquo;s exact address and any access
            instructions, kept as a record of what was agreed when you
            booked.
          </li>
          <li>
            <strong>Provider information:</strong> if you create a provider
            page, your business name, username, description, portfolio
            photos, general service area, and — kept private — your exact
            address, plus the payout and identity details you give Stripe
            when you connect a payment account.
          </li>
          <li>
            <strong>Payments:</strong> Stripe handles and stores your card
            details directly; Ceaute never receives or stores your full card
            number.
          </li>
          <li>
            <strong>Reviews:</strong> the rating and comment you post about a
            completed booking, and which booking it relates to.
          </li>
        </ul>
      </section>

      <section>
        <h2>How we use it</h2>
        <ul>
          <li>To create and confirm bookings and take payment for them.</li>
          <li>
            To show a provider the bookings, contact details, and address
            they need for a confirmed appointment.
          </li>
          <li>
            To email you about your booking — confirmations, cancellations,
            and refunds — using Resend.
          </li>
          <li>
            To show your provider page and any visible reviews to the
            public, if you have a provider page.
          </li>
          <li>To investigate misuse of the platform and keep it working.</li>
        </ul>
        <Todo>
          The specific UK GDPR lawful basis for each use above (for example,
          contract or legitimate interests) has not yet been recorded.
        </Todo>
      </section>

      <section>
        <h2>Who we share it with</h2>
        <ul>
          <li>
            <strong>Stripe</strong> — to process payment and, for providers,
            payouts and the identity checks required to accept payments.
          </li>
          <li>
            <strong>Supabase</strong> — who host our database, run sign-in,
            and store portfolio images on our behalf.
          </li>
          <li>
            <strong>Resend</strong> — who deliver the transactional emails
            listed above on our behalf.
          </li>
          <li>
            <strong>Vercel</strong> — who host the application and its
            infrastructure logs.
          </li>
          <li>
            <strong>The provider you book with</strong> — who sees your name,
            contact details, and, once you have paid, your appointment
            details and address. A customer who books a confirmed appointment
            sees that provider&rsquo;s exact address in the same way.
          </li>
          <li>
            <strong>Other visitors to Ceaute</strong> — who can see a
            provider&rsquo;s public page, portfolio, and any review marked
            visible, shown with its rating and comment rather than your
            account details.
          </li>
        </ul>
        <p>We do not sell personal information.</p>
      </section>

      <section>
        <h2>International transfers</h2>
        <Todo>
          Stripe, Supabase, Resend, and Vercel may process or store data
          outside the UK. Each vendor&rsquo;s data location and transfer
          safeguard needs confirming before this section can describe
          international transfers accurately.
        </Todo>
      </section>

      <section>
        <h2>How long we keep it</h2>
        <Todo>
          Ceaute has not yet decided how long booking, account, or review
          records are kept after an account is closed or a booking is
          completed. This section will state a period once one is set.
        </Todo>
      </section>

      <section>
        <h2>Security</h2>
        <p>
          Your booking and provider data is stored in a database protected by
          row-level access rules, so the application can only reach the same
          data a signed-in user is allowed to see. Provider portfolio images
          are stored privately and shown only through short-lived signed
          links. Signing in uses a one-time emailed code rather than a stored
          password.
        </p>
      </section>

      <section>
        <h2>Cookies</h2>
        <p>
          Ceaute sets only the cookies needed to keep you signed in and to
          complete a booking. We do not use analytics or advertising cookies,
          so we do not show a cookie consent banner.
        </p>
        <Todo>
          Confirm this remains true before adding any analytics or marketing
          tool, and update this section if it changes.
        </Todo>
      </section>

      <section>
        <h2>Your rights</h2>
        <p>
          Under UK data protection law you can ask to see the personal
          information Ceaute holds about you, ask us to correct or delete it,
          object to or restrict some uses, and ask for a copy in a portable
          format.
        </p>
        <Todo>
          Ceaute does not yet have a self-service way to delete an account or
          its data. Until one exists, requests need a confirmed manual
          process and a contact address, neither of which is set yet.
        </Todo>
      </section>

      <section>
        <h2>Complaints</h2>
        <p>
          You can complain to the UK&rsquo;s data protection regulator, the
          Information Commissioner&rsquo;s Office (ICO), at ico.org.uk or on
          0303 123 1113, though we would appreciate the chance to sort things
          out directly first.
        </p>
      </section>

      <section>
        <h2>Changes to this notice</h2>
        <p>Ceaute may update this notice as the product changes.</p>
      </section>
    </LegalPage>
  );
}
