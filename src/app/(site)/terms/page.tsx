import { LegalPage } from "../_components/legal-page";
import {
  legalIdentity,
  needsSeparateAddressForService,
} from "@/lib/legal/identity";

export const metadata = {
  title: "Terms · Ceaute",
};

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms"
      summary="The terms for using Ceaute as a customer or a provider."
      updated="18 September 2026"
    >
      <section>
        <h2>Who operates Ceaute</h2>
        <p>
          Ceaute is a booking platform at {legalIdentity.siteDomain}, operated
          by {legalIdentity.operatorName} as a {legalIdentity.structure} under
          the trading name {legalIdentity.tradingName}. Ceaute is not a limited
          company, so it has no company registration number and no registered
          office. You are contracting with an individual trading under a
          business name.
        </p>
        <ul>
          <li>
            <strong>Trading name:</strong> {legalIdentity.tradingName}
          </li>
          <li>
            <strong>Trader:</strong> {legalIdentity.operatorName}, a{" "}
            {legalIdentity.structure}
          </li>
          <li>
            <strong>Business address:</strong> {legalIdentity.businessAddress}
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
      </section>

      <section>
        <h2>What Ceaute does</h2>
        <p>
          Ceaute lets independent beauty providers publish a page, and lets
          customers find that page, choose a treatment and time, and pay for
          it. Ceaute is not a beauty business. It does not perform, supervise,
          vet, insure or guarantee any treatment, and it does not check a
          provider&rsquo;s qualifications, licences or insurance.
        </p>
        <p>
          The agreement to carry out a treatment is between you and the
          provider. Ceaute is responsible for the booking, payment, refund and
          messaging systems described below, and for operating them with
          reasonable care and skill.
        </p>
      </section>

      <section>
        <h2>Your account</h2>
        <p>
          You need an account to book a treatment or to publish a provider
          page. One account covers both; creating a provider page does not
          create a second account or a different kind of user. We sign you in
          with a six-digit code emailed to you, so there is no password. You
          must give a real email address you can reach, and you are
          responsible for what is done from your account.
        </p>
        <p>
          You can edit your name and phone number under Account. Your email
          address is your sign-in identity and cannot be changed in the
          product, and there is no self-service way to close an account yet.
        </p>
      </section>

      <section>
        <h2>Treatments, prices and availability</h2>
        <p>
          Providers write their own treatment names, descriptions, durations,
          prices and add-ons, and control their own opening hours and blocked
          dates. Ceaute does not check or guarantee that any of it is
          accurate.
        </p>
        <p>
          Prices are in pounds sterling and are the total you pay for the
          treatment and any add-ons you choose. Ceaute does not add a booking
          fee, a service fee or any other charge on top of the price the
          provider sets.
        </p>
        <p>
          Appointments must start at least 24 hours ahead and no more than 60
          days ahead, on a 15-minute start time, inside the provider&rsquo;s
          working hours. All times are London time.
        </p>
      </section>

      <section>
        <h2>Making a booking and when it is confirmed</h2>
        <p>
          Choosing a time holds that slot for five minutes while you confirm
          your details, and the hold is extended to about half an hour once
          you open the Stripe payment page. If you do not finish paying before
          the hold expires, the slot is released and someone else can take it.
        </p>
        <p>
          <strong>A booking is only confirmed when payment succeeds.</strong>{" "}
          Returning from Stripe does not by itself confirm anything; Ceaute
          confirms the booking when Stripe tells us the payment went through.
          You will then see the booking under Account &rarr; Bookings and
          receive a confirmation email. If a payment is taken but cannot
          confirm the booking, it is refunded in full.
        </p>
        <p>
          The price, the amount due now, the cancellation window and any
          written policy are shown to you before you pay, and the version you
          were shown is saved with your booking. A provider changing their
          settings later does not change the terms of a booking you have
          already made.
        </p>
      </section>

      <section>
        <h2>Paying: full payment or a deposit</h2>
        <p>
          Each provider chooses whether customers pay the full price when
          booking or a fixed deposit. Checkout shows which applies, how much
          is due now, and how much is due at the appointment.
        </p>
        <p>
          Payment is taken through Stripe and transferred to the
          provider&rsquo;s own Stripe account. Your card details go directly
          to Stripe; Ceaute never sees or stores your full card number.
        </p>
        <p>
          Where a deposit applies, the balance is paid directly to the
          provider at the appointment. Ceaute does not collect that balance,
          does not process it, and has no part in it.
        </p>
      </section>

      <section>
        <h2>Cancelling, and what a provider can keep</h2>
        <p>
          Each provider sets a cancellation window of 12, 24 or 48 hours
          before the appointment, and may add their own written policy. Both
          are shown before you pay.
        </p>
        <ul>
          <li>
            <strong>Cancel before the deadline</strong> and everything you
            paid online is refunded.
          </li>
          <li>
            <strong>Cancel after the deadline</strong> and the provider keeps
            up to the commitment amount shown to you at checkout — the deposit
            in deposit mode, or the amount the provider set in full-payment
            mode. Anything you paid above that is refunded.
          </li>
        </ul>
        <p>
          You cancel under Account &rarr; Bookings. Only a confirmed booking
          that has not yet started can be cancelled, so a booking cannot be
          cancelled once its start time has passed. Ceaute does not support
          rescheduling: changing an appointment means cancelling it, subject
          to the charge above, and booking again. Ceaute does not charge
          no-show fees or penalties of its own.
        </p>
      </section>

      <section>
        <h2>If a provider cancels</h2>
        <p>
          A provider can cancel a confirmed booking from their dashboard.
          Everything you paid online is then refunded in full, and we email
          you. Refunds go back to the card you paid with through Stripe and
          usually take a few working days to appear. If Stripe is unavailable
          at that moment, Ceaute records the refund and retries it
          automatically, and one that still cannot be completed is picked up
          by hand; the cancellation itself takes effect immediately either
          way.
        </p>
        <p>
          A refund returns the money you paid online. Ceaute does not offer
          compensation, credit or a replacement booking beyond that refund.
        </p>
      </section>

      <section>
        <h2>The treatment address</h2>
        <p>
          Before you pay, you see the provider&rsquo;s general area only.
          Their exact address and any access instructions are released once
          your payment has confirmed the booking — in the confirmation email
          and on the booking in your account.
        </p>
        <p>
          That address is given to you so you can attend your appointment.
          Do not publish it or pass it on.
        </p>
      </section>

      <section>
        <h2>If you book a treatment</h2>
        <p>
          Give accurate contact details, attend appointments you have booked
          or cancel them in good time, treat providers and their premises with
          respect, and tell the provider anything they need to know to carry
          out your treatment safely. Do not use Ceaute for anything other than
          genuine bookings, and do not arrange to pay a provider outside
          Ceaute for a booking made on Ceaute.
        </p>
      </section>

      <section>
        <h2>If you offer treatments on Ceaute</h2>
        <p>
          You are an independent business. You are responsible for your own
          qualifications, training, licences, registrations, insurance, health
          and safety, and tax, and for the standard of every treatment you
          carry out.
        </p>
        <p>
          Keep your treatments, prices, durations, availability, location and
          booking terms accurate and current, honour bookings you have
          accepted, and cancel as early as you can when you cannot. Only
          publish portfolio images you own or have permission to use and that
          show your own work, with the consent of anyone identifiable in them.
        </p>
        <p>
          Before your page can be published you must connect a Stripe account
          able to receive payments and payouts. Stripe collects the identity
          information it needs from you directly and decides whether your
          account can be paid out; Ceaute cannot override that. Customer
          contact details you receive through Ceaute are for delivering that
          customer&rsquo;s appointment, and you become responsible for that
          information under data protection law once you hold it.
        </p>
      </section>

      <section>
        <h2>Reviews</h2>
        <p>
          Only the customer on a completed booking can review it, once, with a
          rating from 1 to 5 and an optional comment. You cannot review your
          own provider page. Reviews cannot be edited or deleted after posting
          — by you or by the provider — and visible reviews appear on the
          provider&rsquo;s public page showing your first name only, or
          &ldquo;Verified customer&rdquo; if you have not given a name.
        </p>
        <p>
          Because every review is tied to a booking that was actually paid for
          and completed, Ceaute does not accept unverified reviews. Do not
          post a review you know to be untrue, post on someone else&rsquo;s
          behalf, offer or accept anything in exchange for a review, or
          otherwise try to influence a rating. Ceaute can hide a review that
          breaks these rules.
        </p>
      </section>

      <section>
        <h2>Complaints and support</h2>
        <p>
          If something goes wrong with how Ceaute itself worked — a payment, a
          refund, a booking that did not appear — email{" "}
          <a href={`mailto:${legalIdentity.contactEmail}`}>
            {legalIdentity.contactEmail}
          </a>{" "}
          and we will look into it. You can also write to Ceaute at{" "}
          {legalIdentity.businessAddress}.
        </p>
        <p>
          A complaint about the treatment itself, or about how a provider
          behaved, is between you and that provider, because they carried it
          out. Raise it with them first. Tell Ceaute as well, and we may look
          into it, but we cannot decide a dispute about a treatment we did not
          perform.
        </p>
      </section>

      <section>
        <h2>Your rights as a consumer</h2>
        <p>
          Nothing in these terms removes or limits your statutory rights, and
          Ceaute does not try to exclude liability for its own negligence or
          for anything that cannot lawfully be excluded.
        </p>
        <p>
          Under the Consumer Rights Act 2015 a service must be carried out
          with reasonable care and skill. For the treatment, that duty is the
          provider&rsquo;s; for the booking and payment service, it is
          Ceaute&rsquo;s. If a treatment is done badly you can ask the
          provider to put it right or to reduce the price.
        </p>
        <p>
          Bookings made through Ceaute are for a specific date and time. Where
          the Consumer Contracts (Information, Cancellation and Additional
          Charges) Regulations 2013 give you a right to cancel a contract made
          at a distance, these terms do not take it away; the
          provider&rsquo;s cancellation window above describes what Ceaute
          refunds in practice, and you can still pursue any statutory right
          you have. Ceaute has not yet taken legal advice on exactly how those
          regulations apply to a fixed-time beauty appointment, and this page
          will be updated when it has.
        </p>
      </section>

      <section>
        <h2>About these terms</h2>
        <p>
          These terms are governed by the law of England and Wales. As a
          consumer you can also bring proceedings in the courts of the part of
          the UK where you live.
        </p>
        <p>
          Ceaute may update these terms as the product changes. Continuing to
          use Ceaute after an update means you accept the updated terms.
        </p>
      </section>
    </LegalPage>
  );
}
