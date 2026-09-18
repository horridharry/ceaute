import { LegalPage, Todo } from "../_components/legal-page";

export const metadata = {
  title: "Terms · Ceaute",
};

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms"
      summary="The terms for using Ceaute as a customer or provider."
      updated="18 September 2026"
      draft
    >
      <section>
        <h2>What Ceaute is</h2>
        <p>
          Ceaute is a booking platform that connects independent beauty
          providers with customers. Ceaute is not a beauty business itself
          and does not perform, supervise, or guarantee any treatment.
        </p>
      </section>

      <section>
        <h2>Providers and customers</h2>
        <p>
          Each provider on Ceaute is an independent business responsible for
          the treatments they list, the prices they set, and the standard of
          the appointment itself. The contract for a treatment is between you
          and the provider, not Ceaute. Ceaute is responsible for the
          booking, payment, and cancellation systems described below.
        </p>
      </section>

      <section>
        <h2>Your account</h2>
        <p>
          You need an account to book a treatment or to publish a provider
          page. One account covers both — creating a provider page does not
          create a second account. We sign you in with a one-time code sent
          to your email address; there is no password to protect. You must
          give us a real, accessible email address and are responsible for
          anything done from your account.
        </p>
      </section>

      <section>
        <h2>Treatments, prices and availability</h2>
        <p>
          Providers write their own treatment descriptions, prices,
          durations, and add-ons, and control their own availability. Ceaute
          does not check or guarantee that a listing is accurate or that a
          provider will honour published availability, though we expect
          providers to keep this information current.
        </p>
      </section>

      <section>
        <h2>Booking confirmation and payment</h2>
        <p>
          A booking is not confirmed until payment succeeds. Selecting a time
          places a short hold on that slot while you complete payment through
          Stripe; if payment is not completed in time, the hold is released
          and the slot becomes available again. Once payment succeeds, we
          confirm the booking and reveal the provider&rsquo;s exact address
          and any access instructions — before payment, you only see the
          provider&rsquo;s general area.
        </p>
      </section>

      <section>
        <h2>Full payments and deposits</h2>
        <p>
          Each provider decides whether customers pay in full at booking or
          pay a fixed deposit online, with the remainder due later. If a
          deposit applies, the remaining balance is an arrangement directly
          between you and the provider — Ceaute does not collect it and is
          not responsible for it. Whichever applies, and the cancellation
          window described below, is shown to you before you pay, and the
          terms shown at that point are locked to your booking even if the
          provider changes their settings afterwards.
        </p>
      </section>

      <section>
        <h2>Cancellation deadlines and charges</h2>
        <p>
          Each provider sets a cancellation window of 12, 24, or 48 hours,
          and may add their own written cancellation policy. Both are shown
          to you before you pay. If you cancel before the deadline, the
          amount you paid online is refunded in full. If you cancel after the
          deadline, the provider keeps up to the deposit or full payment
          amount shown at booking, and any remainder is refunded. Ceaute does
          not currently support rescheduling a booking; changing a booking
          means cancelling it, subject to these charges, and booking again.
        </p>
      </section>

      <section>
        <h2>If a provider cancels</h2>
        <p>
          If a provider cancels a confirmed booking, the full amount you paid
          online is refunded. Refunds are returned to your original payment
          method through Stripe; they can take a few business days to appear
          and, rarely, may be delayed while Ceaute retries a refund after a
          payment processor outage — the cancellation itself still takes
          effect immediately.
        </p>
        <Todo>
          Whether Ceaute owes a customer anything beyond the refund itself
          when a provider cancels (for example, goodwill credit) is not
          decided or implemented, and this page does not promise it.
        </Todo>
      </section>

      <section>
        <h2>Your responsibilities</h2>
        <p>
          You agree to give accurate contact and payment details, to attend
          appointments you have booked or cancel them in good time, to treat
          providers and their premises appropriately, and not to use Ceaute
          to arrange or pay for anything other than a genuine booking.
        </p>
      </section>

      <section>
        <h2>Reviews and prohibited use</h2>
        <p>
          Only the customer on a completed booking can leave a review of it,
          once, and reviews cannot currently be edited after posting. You
          must not post a review you know to be false, post on behalf of
          someone else, or try to manipulate ratings. You must not use Ceaute
          to harass another user, try to pay a provider for a Ceaute booking
          outside Ceaute&rsquo;s payment system, or interfere with the
          service.
        </p>
        <Todo>
          What action Ceaute takes against a violation of this section —
          warning, review removal, account suspension — is not yet decided
          or built, and none is promised here.
        </Todo>
      </section>

      <section>
        <h2>Complaints and support</h2>
        <p>
          If something goes wrong with a booking, contact support first (see
          Help). Ceaute can help with problems in how the platform itself
          worked. Because the treatment is provided by an independent
          provider, a dispute about the treatment itself is between you and
          the provider, though Ceaute may look into a complaint.
        </p>
        <Todo>
          Ceaute&rsquo;s complaint-handling process and any response-time
          commitment are not yet defined.
        </Todo>
      </section>

      <section>
        <h2>Applicable consumer rights</h2>
        <p>
          As a UK consumer, you may have statutory rights under the Consumer
          Rights Act 2015 and other consumer protection law that apply
          alongside these terms and that these terms do not remove.
        </p>
        <Todo>
          Whether the Consumer Contracts Regulations 2013 cooling-off right
          applies to a date- and time-specific beauty appointment booked
          through Ceaute has not been confirmed with a legal adviser, and
          this page should be updated with the answer rather than leave the
          general statement above as the last word.
        </Todo>
      </section>

      <section>
        <h2>About these terms</h2>
        <Todo>
          The legal entity operating Ceaute, its company number and
          registered address, the law governing these terms, and a contact
          address for questions about them are not yet set — none of this
          exists in the product today and none is invented here.
        </Todo>
        <p>
          Ceaute may update these terms as the product changes. Continuing to
          use Ceaute after an update means you accept the new terms.
        </p>
      </section>
    </LegalPage>
  );
}
