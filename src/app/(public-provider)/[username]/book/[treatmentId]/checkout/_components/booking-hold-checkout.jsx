import { BookingInspirationImages } from "@/components/booking-inspiration-images";
import { PendingButton } from "@/components/pending-button";
import {
  formatDateLabel,
  formatDurationMinutes,
  formatPricePence,
  formatTimeLabel,
} from "@/features/storefront/format";
import {
  addBookingImagesDuringCheckout,
  removeBookingImageDuringCheckout,
} from "../../../inspiration-actions";
import { startStripeCheckoutForBooking } from "../../../actions";
import { describeLateCancellationOutcome } from "../_lib/checkout-display";
import { PolicyNotice } from "./policy-notice";

export function BookingHoldCheckout({
  displayState,
  paymentNotice,
  serviceSnapshot,
  selectedAddOns,
  holdStartAt,
  holdEndAt,
  paymentAmounts,
  isConfirmed,
  inspiration,
  holdSummary,
  returnPath,
}) {
  return (
    <main className="container max-w-md p-5">
      <div className="mt-6 flex flex-col">
        <h1 className="text-3xl font-bold tracking-tighter">
          {displayState.heading}
        </h1>
        <p className="mt-1 text-sm">
          {displayState.message}
        </p>

        {paymentNotice ? (
          <div
            role="status"
            className="mt-8 rounded-xl border border-red-200 p-4 text-sm text-red-700"
          >
            <p className="font-semibold">{paymentNotice.heading}</p>
            <p className="mt-1">{paymentNotice.message}</p>
          </div>
        ) : null}

        <section className="mt-8 rounded-xl border border-black/10 p-4">
          <h2 className="text-lg font-semibold tracking-tighter">
            Booking summary
          </h2>
          <div className="mt-4 flex flex-col gap-3 text-sm">
            <div>
              <p className="font-semibold">
                {serviceSnapshot.provider_display_name}
              </p>
              <p className="text-black/60">
                @{serviceSnapshot.provider_username}
              </p>
              <p className="text-black/60">{serviceSnapshot.public_area}</p>
            </div>
            <div>
              <p className="font-semibold">{serviceSnapshot.treatment_name}</p>
              {selectedAddOns.length ? (
                <ul className="mt-1 text-black/60">
                  {selectedAddOns.map((addOn) => (
                    <li key={addOn.id}>
                      + {addOn.name} (
                      {formatPricePence(addOn.additional_price_pence)},{" "}
                      {formatDurationMinutes(
                        addOn.additional_duration_minutes,
                      )}
                      )
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
            <div>
              <p className="font-semibold">
                {formatDateLabel(holdStartAt)} · {formatTimeLabel(holdStartAt)}{" "}
                - {formatTimeLabel(holdEndAt)}
              </p>
              <p className="text-black/60">
                Total duration:{" "}
                {formatDurationMinutes(serviceSnapshot.duration_minutes)}
              </p>
            </div>
            <div className="border-t pt-3">
              <p className="flex justify-between">
                <span>Total price</span>
                <span className="font-semibold">
                  {formatPricePence(serviceSnapshot.total_price_pence)}
                </span>
              </p>
              <p className="flex justify-between">
                <span>Due now</span>
                <span className="font-semibold">
                  {formatPricePence(paymentAmounts.amountChargedPence)}
                </span>
              </p>
              <p className="flex justify-between">
                <span>Due at appointment</span>
                <span className="font-semibold">
                  {formatPricePence(paymentAmounts.amountDueLaterPence)}
                </span>
              </p>
            </div>
            <div className="border-t pt-3 text-black/60">
              <p>
                Cancellation window:{" "}
                {serviceSnapshot.cancellation_window_hours ?? 24} hours.
              </p>
              <p>
                {describeLateCancellationOutcome({
                  commitmentAmountPence:
                    serviceSnapshot.commitment_amount_pence,
                  amountDueNowPence: paymentAmounts.amountChargedPence,
                })}
              </p>
              {serviceSnapshot.written_policy ? (
                <p className="mt-2 whitespace-pre-wrap">
                  {serviceSnapshot.written_policy}
                </p>
              ) : null}
            </div>
            {isConfirmed ? (
              <div className="border-t pt-3">
                <p className="font-semibold">Exact address</p>
                <p>{serviceSnapshot.address_line_1}</p>
                {serviceSnapshot.address_line_2 ? (
                  <p>{serviceSnapshot.address_line_2}</p>
                ) : null}
                <p>
                  {serviceSnapshot.city} {serviceSnapshot.postcode}
                </p>
                {serviceSnapshot.access_instructions ? (
                  <p className="mt-2 text-black/60">
                    {serviceSnapshot.access_instructions}
                  </p>
                ) : null}
              </div>
            ) : (
              <p className="border-t border-black/10 pt-3 text-black/60">
                Exact address appears after confirmation.
              </p>
            )}
            {displayState.showHoldExpiry ? (
              <p className="text-black/60">
                Hold expires at{" "}
                {formatTimeLabel(new Date(holdSummary.expires_at))}.
              </p>
            ) : null}
          </div>
        </section>

        <section className="mt-8 rounded-xl border border-black/10 p-4">
          <BookingInspirationImages
            images={inspiration.images}
            allowance={inspiration.allowance}
            canManage={displayState.canPay && !inspiration.unavailable}
            addAction={addBookingImagesDuringCheckout}
            removeAction={removeBookingImageDuringCheckout}
            hiddenFields={{
              booking_id: holdSummary.id,
              return_path: returnPath,
            }}
            description={
              inspiration.unavailable
                ? "Inspiration images cannot be shown right now. You can add them later from your booking."
                : displayState.canPay
                  ? "Optional. Add an inspiration image for your provider. You can update it later from your booking."
                  : "Images attached to this booking."
            }
          />
        </section>

        {displayState.canPay ? (
          <div className="mt-8 flex flex-col items-end gap-3">
            <form action={startStripeCheckoutForBooking}>
              <input type="hidden" name="booking_id" value={holdSummary.id} />
              <input type="hidden" name="return_path" value={returnPath} />
              <PendingButton
                pendingLabel="Opening Stripe..."
                className="w-max rounded-lg bg-pink-700 p-3 px-4 text-sm font-semibold text-white shadow-sm duration-200 hover:bg-pink-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Pay with Stripe
              </PendingButton>
            </form>
            <PolicyNotice />
          </div>
        ) : null}
      </div>
    </main>
  );
}
