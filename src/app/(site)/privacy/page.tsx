import { LegalPage } from "../_components/legal-page";
import { legalIdentity } from "@/lib/legal/identity";

export const metadata = {
  title: "Privacy · Ceaute",
};

// Deliberately short for the pilot (decided 28 September 2026 by the product
// owner): the full notice comes back before providers who are not personal
// connections join. See docs/pilot.md.
export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy"
      summary="What personal information Ceaute holds, why, and what you can do about it."
      updated="28 September 2026"
    >
      <section>
        <h2>What we collect and why</h2>
        <ul>
          <li>
            <strong>Your email address</strong>, to sign you in with a
            six-digit code. There is no password.
          </li>
          <li>
            <strong>Your name and phone number</strong>, so the provider you
            book can identify you and reach you.
          </li>
          <li>
            <strong>Your bookings, payments, refunds and reviews</strong>, as
            a record of what was agreed. Ceaute holds no card details: you
            enter them on Stripe&rsquo;s own payment page.
          </li>
          <li>
            <strong>If you publish a provider page</strong>: your page
            details, photos, treatments, your appointment address (shown
            only to customers with a confirmed, paid booking), and
            the dates and times you open for booking, and when they open.
          </li>
        </ul>
        <p>
          We use it only to run bookings. We do not send marketing email, use
          analytics or advertising cookies, or sell personal information.
        </p>
      </section>

      <section>
        <h2>Who we share it with</h2>
        <p>
          The provider you book with, once your booking is confirmed; Stripe,
          for payments and refunds; and the services that run Ceaute:
          Supabase (database and sign-in), Resend (emails) and Vercel
          (hosting). Some of these process data outside the UK.
        </p>
      </section>

      <section>
        <h2>Your rights</h2>
        <p>
          You can ask for a copy of your information, or ask us to correct or
          delete it, at{" "}
          <a href={`mailto:${legalIdentity.contactEmail}`}>
            {legalIdentity.contactEmail}
          </a>
          . You can also complain to the Information Commissioner&rsquo;s
          Office at ico.org.uk.
        </p>
      </section>
    </LegalPage>
  );
}
