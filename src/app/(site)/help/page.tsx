import { LegalPage } from "../_components/legal-page";

export const metadata = {
  title: "Help · Ceaute",
};

export default function HelpPage() {
  return (
    <LegalPage
      title="Help"
      summary="Support for customers and providers using Ceaute."
      updated="18 September 2026"
    >
      <section>
        <h2>How to book</h2>
        <p>
          Open a provider&rsquo;s page, choose a treatment, and pick a time.
          Before you pay you&rsquo;ll see the price, how much is due now, the
          cancellation window, and the provider&rsquo;s general area.
          Selecting a time holds it for a few minutes while you complete
          payment — if payment isn&rsquo;t finished in time, the hold is
          released and someone else can book it.
        </p>
      </section>

      <section>
        <h2>Deposits and full payments</h2>
        <p>
          Each provider decides whether you pay the full price or a fixed
          deposit when you book. If it&rsquo;s a deposit, checkout shows
          exactly how much is due now, and the rest is due directly to the
          provider at the appointment — Ceaute does not collect that
          remaining amount.
        </p>
      </section>

      <section>
        <h2>Where booking confirmations arrive</h2>
        <p>
          Once payment succeeds, we email you a confirmation with the
          appointment details and, from that point on, the provider&rsquo;s
          exact address and any access instructions. You can also see the
          same details any time under Account &rarr; Bookings.
        </p>
      </section>

      <section>
        <h2>How to cancel a booking</h2>
        <p>
          Go to Account &rarr; Bookings, open the booking, and use the cancel
          option there. Cancelling before the provider&rsquo;s cancellation
          deadline — shown when you booked and on the booking itself — gets
          you a full refund. Cancelling after that deadline refunds
          everything except up to the amount the provider is allowed to
          keep, as shown before you paid.
        </p>
      </section>

      <section>
        <h2>If a provider cancels</h2>
        <p>
          You&rsquo;ll get an email, and the amount you paid online is
          refunded in full automatically. Refunds return to your original
          payment method through Stripe and can take a few days to appear.
        </p>
      </section>

      <section>
        <h2>How providers receive bookings</h2>
        <p>
          New bookings appear under Dashboard &rarr; Bookings as soon as a
          customer pays, and you&rsquo;ll also get an email for every
          booking, cancellation, and refund. You can cancel a booking from
          there too, which refunds the customer in full.
        </p>
      </section>

      <section>
        <h2>Contact support</h2>
        <p>
          Ceaute is currently in private alpha. Contact support using the
          email address the Ceaute team gave you when you were invited.
        </p>
      </section>
    </LegalPage>
  );
}
