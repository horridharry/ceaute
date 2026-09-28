import { LegalPage } from "../_components/legal-page";
import { legalIdentity } from "@/lib/legal/identity";

export const metadata = {
  title: "Terms · Ceaute",
};

// Deliberately short for the pilot (decided 28 September 2026 by the product
// owner): the full terms, trader details and consumer-rights sections come
// back before providers who are not personal connections join. See
// docs/pilot.md.
export default function TermsPage() {
  return (
    <LegalPage
      title="Terms"
      summary="The terms for using Ceaute as a customer or a provider."
      updated="28 September 2026"
    >
      <section>
        <h2>What Ceaute does</h2>
        <p>
          Ceaute lets independent beauty providers publish a page, and lets
          customers choose a treatment and time and pay for it. The treatment
          itself is between you and the provider. Providers write their own
          treatments and prices,
          and choose which dates and times to open for booking, and when.
          Ceaute does not check or guarantee that any of it is accurate.
        </p>
      </section>

      <section>
        <h2>Booking and paying</h2>
        <p>
          Appointments must start at least 24 hours ahead, on a date the
          provider has opened for booking, at a start time the provider
          offers. All times are London time.
        </p>
        <p>
          A booking is confirmed only when payment succeeds. Each provider
          chooses whether customers pay the full price when booking or a
          deposit. A deposit is either a fixed amount set by the provider, of
          at least £1, or a percentage of the booking price between 10% and
          90% and at least £1. A deposit is never more than the booking price.
          Checkout shows which applies, how much is due now, and how much is
          due at the appointment. Payment is taken by Stripe; Ceaute never
          sees your card details.
        </p>
      </section>

      <section>
        <h2>Cancelling</h2>
        <ul>
          <li>
            <strong>Cancel before the deadline</strong> shown at checkout and
            everything you paid online is refunded.
          </li>
          <li>
            <strong>Cancel after the deadline</strong> and the provider keeps
            the amount shown to you at checkout, never more than you paid
            online. With a deposit that is the whole deposit; with full
            payment it is the percentage the provider set. Anything you paid
            above that is refunded. Bookings keep the terms they were made on.
          </li>
          <li>
            <strong>If the provider cancels</strong>, everything you paid
            online is refunded.
          </li>
        </ul>
      </section>

      <section id="providers">
        <h2>If you offer treatments on Ceaute</h2>
        <p>
          You are an independent business, responsible for your treatments,
          your insurance and your tax. Your page is published once you have
          connected a Stripe account and accepted the provider agreement.
        </p>
        <p>
          From each payment Ceaute processes for you, Stripe&rsquo;s card
          processing charge and Ceaute&rsquo;s 2% platform fee are deducted,
          and the rest is paid to your Stripe account. A balance the customer
          pays you at the appointment is yours in full.
        </p>
        <ul>
          <li>
            If a customer cancels inside your cancellation window, it costs
            you nothing.
          </li>
          <li>
            If a customer cancels after your window, Ceaute&rsquo;s 2% is
            charged on the amount you keep, and Stripe&rsquo;s charge remains
            your cost.
          </li>
          <li>
            If you cancel, Ceaute returns its fee and Stripe&rsquo;s charge is
            your cost.
          </li>
          <li>
            If a customer&rsquo;s bank reverses a payment in a dispute that
            was your responsibility, you owe the reversed amount. Stripe&rsquo;s
            dispute fee is Ceaute&rsquo;s cost, not yours.
          </li>
        </ul>
      </section>

      <section>
        <h2>Contact</h2>
        <p>
          Questions or problems:{" "}
          <a href={`mailto:${legalIdentity.contactEmail}`}>
            {legalIdentity.contactEmail}
          </a>
          .
        </p>
      </section>
    </LegalPage>
  );
}
