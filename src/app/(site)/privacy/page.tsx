import { LegalPage } from "../_components/legal-page";
import {
  legalIdentity,
  needsSeparateAddressForService,
} from "@/lib/legal/identity";

export const metadata = {
  title: "Privacy · Ceaute",
};

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy"
      summary="What personal information Ceaute holds, why, and what you can do about it."
      updated="18 September 2026"
    >
      <section>
        <h2>Who we are and how to contact us</h2>
        <p>
          Ceaute operates the booking platform at ceaute.com and decides how
          the information described here is used, which makes Ceaute the data
          controller for it. Ceaute is operated by {legalIdentity.operatorName}{" "}
          as a {legalIdentity.structure} under the trading name{" "}
          {legalIdentity.tradingName}, so the data controller is an individual
          rather than a company — there is no company registration number and
          no registered office.
        </p>
        <ul>
          <li>
            <strong>Data controller:</strong> {legalIdentity.operatorName},
            trading as {legalIdentity.tradingName}
          </li>
          <li>
            <strong>Address:</strong> {legalIdentity.businessAddress}
          </li>
          {needsSeparateAddressForService() ? (
            <li>
              <strong>Address for service:</strong>{" "}
              {legalIdentity.addressForService}
            </li>
          ) : null}
          <li>
            <strong>Email:</strong>{" "}
            <a href={`mailto:${legalIdentity.contactEmail}`}>
              {legalIdentity.contactEmail}
            </a>
          </li>
        </ul>
        <p>
          Use that email for anything in this notice, including a request about
          your own information.
        </p>
        <p>
          Ceaute has not appointed a Data Protection Officer; it is not
          required to.
        </p>
      </section>

      <section>
        <h2>What we collect and why</h2>
        <ul>
          <li>
            <strong>Your email address</strong>, to create your account and
            sign you in. We do not store a password — signing in works by
            emailing you a six-digit code.
          </li>
          <li>
            <strong>Your name and UK phone number</strong>, if you add them.
            Both are required to make a booking, so the provider can identify
            you and reach you about the appointment.
          </li>
          <li>
            <strong>Your bookings</strong>: the provider, treatment, any
            add-ons, price, duration, date and time, the payment and
            cancellation terms that applied, and your name and phone number as
            they were when you booked. This is kept as a record of what was
            agreed.
          </li>
          <li>
            <strong>Cancellation and refund records</strong>: when a booking
            was cancelled, by whom, and how much was refunded or retained.
          </li>
          <li>
            <strong>If you publish a provider page</strong>: your business
            name, username, category, biography, portfolio images, the general
            area you show publicly, your working hours and blocked dates, your
            treatments and prices, and your full appointment address and
            access instructions. The address is held privately and is never
            shown on your public page.
          </li>
          <li>
            <strong>Payment records</strong>: the amount, currency, status and
            Stripe&rsquo;s reference numbers for each payment and refund.{" "}
            <strong>
              Ceaute holds no card details at all
            </strong>{" "}
            — not your card number, not the last four digits, not the expiry
            date. Your card details are entered on Stripe&rsquo;s own payment
            page and never reach Ceaute.
          </li>
          <li>
            <strong>Reviews</strong>: your rating, any comment, and which
            completed booking it belongs to.
          </li>
          <li>
            <strong>Technical logs</strong> created by hosting the site, such
            as IP address, browser type and the page requested, used to keep
            the service running and to investigate faults and abuse.
          </li>
        </ul>
        <p>
          Ceaute does not collect health information. Do not put allergies,
          medical conditions or other health details into a booking note, a
          review or your profile — tell your provider directly instead.
        </p>
        <p>
          Giving your email address is necessary to have an account, and your
          name and phone number are necessary to make a booking. Without them
          we cannot provide the service.
        </p>
      </section>

      <section>
        <h2>Our lawful bases</h2>
        <ul>
          <li>
            <strong>Performing our contract with you</strong> (UK GDPR Article
            6(1)(b)) — creating and securing your account, taking payment,
            confirming and cancelling bookings, giving the provider what they
            need to carry out your appointment, processing refunds, and
            sending the booking emails described below.
          </li>
          <li>
            <strong>Our legal obligations</strong> (Article 6(1)(c)) — keeping
            payment and refund records for tax and accounting, and responding
            to data protection requests.
          </li>
          <li>
            <strong>Our legitimate interests</strong> (Article 6(1)(f)) —
            keeping the platform secure and working, investigating misuse and
            fraud, showing published provider pages and their reviews so
            customers can choose a provider, and defending legal claims. Our
            interest is in running a marketplace that customers and providers
            can trust, and we consider this does not override your rights
            because the information involved is limited to what the service
            itself produces.
          </li>
        </ul>
        <p>
          Ceaute does not send marketing email and does not rely on consent
          for anything described in this notice. The only emails we send are
          your sign-in code and confirmations and cancellations for your own
          bookings.
        </p>
      </section>

      <section>
        <h2>Where we get it from</h2>
        <p>
          Almost everything here comes from you, when you create an account,
          book a treatment, publish a provider page or leave a review. We also
          receive payment outcomes from Stripe — whether a payment or refund
          succeeded, and its reference — and technical logs are generated
          automatically when your browser requests a page.
        </p>
      </section>

      <section>
        <h2>Who we share it with</h2>
        <ul>
          <li>
            <strong>The provider you book with.</strong> Once your payment
            confirms a booking, they see your name, phone number and the
            appointment details. They are a separate, independent business and
            become responsible for that information in their own right, under
            their own obligations, once they hold it.
          </li>
          <li>
            <strong>You, as a customer, see the provider&rsquo;s exact
            address</strong> and any access instructions, but only once a
            booking is confirmed and paid for.
          </li>
          <li>
            <strong>Anyone visiting Ceaute</strong> can see a published
            provider page, its portfolio and its visible reviews. A review
            shows your first name only, or &ldquo;Verified customer&rdquo; if
            you have not given a name.
          </li>
          <li>
            <strong>Stripe</strong> processes payments, refunds and provider
            payouts.
          </li>
          <li>
            <strong>Supabase</strong> hosts our database, runs sign-in and
            stores provider portfolio images.
          </li>
          <li>
            <strong>Resend</strong> delivers our booking emails.
          </li>
          <li>
            <strong>Vercel</strong> hosts the website and holds its technical
            logs.
          </li>
        </ul>
        <p>
          Supabase, Resend and Vercel act only on our instructions, under
          contracts that require them to keep the information secure and to
          use it for nothing else. Stripe is different: it acts on our
          instructions when processing a payment, but decides for itself how
          to use payment data for fraud prevention and for the financial-crime
          and anti-money-laundering checks the law requires of it. Stripe
          publishes its own privacy policy at stripe.com/gb/privacy.
        </p>
        <p>
          We may also share information where the law requires it, or to
          establish or defend a legal claim.{" "}
          <strong>We do not sell personal information</strong>, and we do not
          share it with advertisers or data brokers.
        </p>
      </section>

      <section>
        <h2>Where your information is held</h2>
        <p>
          Ceaute serves only UK customers and UK providers, but our suppliers
          are based outside the UK and some of your information is processed
          abroad.
        </p>
        <ul>
          <li>
            <strong>The website</strong> runs on Vercel Inc., a US company.
            Requests reach it through Vercel&rsquo;s London location and the
            application itself runs in Dublin. Vercel does not commit to where
            its technical logs are stored, so we cannot tell you they stay in
            the UK or Ireland.
          </li>
          <li>
            <strong>The database, sign-in and portfolio images</strong> are run
            by Supabase Pte. Ltd., a Singapore company. Your project data is
            stored in the cloud region we selected, and Supabase&rsquo;s own
            staff and support systems can reach it from outside the UK.
          </li>
          <li>
            <strong>Booking emails</strong> are delivered by Resend (Plus Five
            Five, Inc., a US company). Resend stores all email records,
            including the message and its metadata, in the United States
            whichever region the message is sent from.
          </li>
          <li>
            <strong>Payments.</strong> Stripe transfers payment data outside
            the UK, including to the United States and India.
          </li>
        </ul>
        <p>
          Each of these suppliers contracts with us on the European
          Commission&rsquo;s standard contractual clauses together with the UK
          International Data Transfer Addendum issued by the Information
          Commissioner&rsquo;s Office, which is the safeguard UK law requires
          for personal data leaving the UK. Some of them additionally rely on
          the UK extension to the EU&ndash;US Data Privacy Framework.
        </p>
      </section>

      <section>
        <h2>How long we keep it</h2>
        <ul>
          <li>
            <strong>Bookings, payments and refunds: six years</strong> after
            the appointment. These are business and tax records, and six years
            is also the period in which a claim about them could be brought.
          </li>
          <li>
            <strong>Your account and profile:</strong> until you ask us to
            delete them. Because the two are linked, a booking record within
            its six-year period is kept even after the account behind it is
            closed.
          </li>
          <li>
            <strong>Reviews and provider page content:</strong> while the
            provider page is published.
          </li>
          <li>
            <strong>Booking emails at our email supplier:</strong> Resend
            deletes the message and its records after 30 days. Our own record
            that the email was sent stays with the booking.
          </li>
          <li>
            <strong>Technical logs:</strong> kept only for the short period
            Vercel retains them, which is measured in hours or days rather
            than months.
          </li>
        </ul>
        <p>
          Ceaute does not yet have a self-service way to close an account or
          delete your data, so a deletion request is handled by hand.
        </p>
      </section>

      <section>
        <h2>How we protect it</h2>
        <p>
          Your data sits in a PostgreSQL database with row-level security, so
          the database itself — not just the application — enforces which
          signed-in person can read which row. Provider addresses are withheld
          by database functions until a booking is confirmed and paid for, so
          the rule holds no matter which part of the product asks. Portfolio
          images are kept in private storage and shown through short-lived
          signed links. Sign-in uses a one-time emailed code, so there is no
          password to steal, and Ceaute never receives your card details.
        </p>
      </section>

      <section>
        <h2>Cookies</h2>
        <p>
          Ceaute sets only the cookies it needs to keep you signed in and to
          carry you through a booking. There is no analytics, advertising or
          tracking on this site, and nothing that would need a consent banner.
          If that ever changes, this notice and the site will change with it.
        </p>
      </section>

      <section>
        <h2>Automated decisions</h2>
        <p>
          Ceaute does not profile you and makes no decision about you by
          automated means that has a legal or similarly significant effect.
        </p>
      </section>

      <section>
        <h2>Your rights</h2>
        <p>Under UK data protection law you can ask us to:</p>
        <ul>
          <li>give you a copy of the personal information we hold about you;</li>
          <li>correct anything that is wrong or incomplete;</li>
          <li>
            delete it, though we may have to keep booking and payment records
            for the six years described above;
          </li>
          <li>restrict how we use it, or object to our using it;</li>
          <li>
            give you, or another service, a copy in a portable format where
            that applies.
          </li>
        </ul>
        <p>
          You do not have to pay to exercise any of these, and we must respond
          within one month. Send a request to{" "}
          <a href={`mailto:${legalIdentity.contactEmail}`}>
            {legalIdentity.contactEmail}
          </a>{" "}
          or to {legalIdentity.businessAddress}.
        </p>
      </section>

      <section>
        <h2>How to complain</h2>
        <p>
          Please tell us first, at{" "}
          <a href={`mailto:${legalIdentity.contactEmail}`}>
            {legalIdentity.contactEmail}
          </a>
          , so we can put it right. You can also complain to
          the Information Commissioner&rsquo;s Office, the UK&rsquo;s data
          protection regulator, at ico.org.uk/make-a-complaint or on 0303 123
          1113, or by writing to the Information Commissioner&rsquo;s Office,
          Wycliffe House, Water Lane, Wilmslow, Cheshire SK9 5AF. Complaining
          to us first does not affect your right to go to the ICO.
        </p>
      </section>

      <section>
        <h2>Changes to this notice</h2>
        <p>
          Ceaute may update this notice as the product changes, and the date at
          the top of this page shows when it was last updated.
        </p>
      </section>
    </LegalPage>
  );
}
