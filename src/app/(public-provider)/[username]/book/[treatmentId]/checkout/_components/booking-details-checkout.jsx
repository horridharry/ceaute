import {
  formatDateLabel,
  formatDurationMinutes,
  formatPricePence,
  formatTimeLabel,
} from "@/features/storefront/format";
import { createBookingHoldFromDetails } from "../../../actions";
import { PolicyNotice } from "./policy-notice";
import { SubmitButton } from "./submit-button";

export function BookingDetailsCheckout({
  providerPage,
  treatment,
  selectedAddOns,
  startAt,
  endAt,
  totalDurationMinutes,
  totalPricePence,
  location,
  bookingSettings,
  paymentSummary,
  profileResult,
}) {
  return (
    <main className="container max-w-md p-5">
      <div className="mt-6 flex flex-col">
        <h1 className="text-3xl font-bold tracking-tighter">
          Review details
        </h1>

        <section className="mt-8 rounded-xl border border-black/10 p-4">
          <h2 className="text-lg font-semibold tracking-tighter">
            Order summary
          </h2>
          <div className="mt-4 flex flex-col gap-3 text-sm">
            <div>
              <p className="font-semibold">{providerPage.display_name}</p>
              <p className="text-black/60">@{providerPage.username}</p>
              {location.public_area ? (
                <p className="text-black/60">{location.public_area}</p>
              ) : null}
            </div>
            <div>
              <p className="font-semibold">{treatment.name}</p>
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
                {formatDateLabel(startAt)} · {formatTimeLabel(startAt)} -{" "}
                {formatTimeLabel(endAt)}
              </p>
              <p className="text-black/60">
                Total duration: {formatDurationMinutes(totalDurationMinutes)}
              </p>
            </div>
            <div className="border-t pt-3">
              <p className="flex justify-between">
                <span>Total price</span>
                <span className="font-semibold">
                  {formatPricePence(totalPricePence)}
                </span>
              </p>
              <p className="flex justify-between">
                <span>Due now</span>
                <span className="font-semibold">
                  {formatPricePence(paymentSummary.amountDueNow)}
                </span>
              </p>
              <p className="flex justify-between">
                <span>Due at appointment</span>
                <span className="font-semibold">
                  {formatPricePence(paymentSummary.amountDueAtAppointment)}
                </span>
              </p>
            </div>
            <div className="border-t pt-3 text-black/60">
              <p>
                Cancellation window:{" "}
                {bookingSettings.cancellation_window_hours ?? 24} hours.
              </p>
              <p>{paymentSummary.cancellationOutcome}</p>
              {bookingSettings.written_policy ? (
                <p className="mt-2 whitespace-pre-wrap">
                  {bookingSettings.written_policy}
                </p>
              ) : null}
            </div>
          </div>
        </section>

        <form
          action={createBookingHoldFromDetails}
          id="booking_details"
          className="mt-8 flex flex-col gap-4"
        >
          <input type="hidden" name="username" value={providerPage.username} />
          <input type="hidden" name="treatment_id" value={treatment.id} />
          <input type="hidden" name="start_at" value={startAt.toISOString()} />
          {selectedAddOns.map((addOn) => (
            <input key={addOn.id} type="hidden" name="add_on" value={addOn.id} />
          ))}
          <span className="field-set">
            <label htmlFor="full_name" className="label">
              Full name
            </label>
            <input
              type="text"
              id="full_name"
              name="full_name"
              required
              defaultValue={profileResult.data?.full_name ?? ""}
              className="field"
            />
          </span>
          <span className="field-set">
            <label htmlFor="phone" className="label">
              Phone number
            </label>
            <input
              type="tel"
              id="phone"
              name="phone"
              required
              defaultValue={profileResult.data?.phone_e164 ?? ""}
              className="field"
            />
          </span>
          <div className="mt-8 flex flex-col items-end gap-4">
            <SubmitButton />
          </div>
        </form>
        <PolicyNotice />
      </div>
    </main>
  );
}
