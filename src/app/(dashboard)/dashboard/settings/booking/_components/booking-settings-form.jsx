"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { FormActions } from "@/components/ui/form-actions";
import { FormError } from "@/components/ui/form-feedback";
import { Notice } from "@/components/ui/notice";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { keepFormValuesOnSubmit } from "@/lib/forms/keep-form-values";
import { bookingTermsExample, percentOptions } from "@/lib/payments/booking-terms";
import { formatPricePence } from "@/features/storefront/format";
import { DashboardPage } from "../../../_components/dashboard-page";

const PAYMENT_CHOICES = [
  { value: "deposit", label: "Deposit", hint: "Customers pay a percentage when they book and the rest at the appointment." },
  { value: "full", label: "Full payment", hint: "Customers pay the whole price when they book." },
];

// What the chosen terms mean, in words and on a £40.00 booking. Every allowed
// percentage of £40 is a whole number of pence, so nothing here rounds.
function Explanation({ paymentMode, depositPercent, windowHours }) {
  const example = bookingTermsExample({ paymentMode, depositPercent });

  if (!example) {
    return "Choose a percentage to see what customers pay.";
  }

  const price = formatPricePence(example.pricePence);

  if (paymentMode === "deposit") {
    return (
      <>
        Customers pay {depositPercent}% of the booking price when they book, and at least
        £1. The rest is paid to you at the appointment. If they cancel less than{" "}
        {windowHours} hours before, you keep that {depositPercent}%.
        <span className="mt-1 block text-ink-muted">
          On a {price} booking: {formatPricePence(example.payNowPence)} now,{" "}
          {formatPricePence(example.laterPence)} at the appointment.
        </span>
      </>
    );
  }

  return (
    <>
      Customers pay the full price when they book. If they cancel less than {windowHours}{" "}
      hours before, you keep {depositPercent}%
      {example.refundedPence > 0 ? " and the rest is refunded" : ""}.
      <span className="mt-1 block text-ink-muted">
        On a {price} booking: they pay {price}; a late cancellation keeps{" "}
        {formatPricePence(example.keptPence)}
        {example.refundedPence > 0
          ? ` and refunds ${formatPricePence(example.refundedPence)}`
          : ""}
        .
      </span>
    </>
  );
}

// Settings saved before percentage terms are kept, not converted, and no
// longer count as complete. Say so plainly and what it means for bookings.
function LegacyNotice({ legacy, pageStatus }) {
  if (!legacy) {
    return null;
  }

  const oldAmount =
    legacy.amountPence !== null && legacy.amountPence !== undefined
      ? formatPricePence(legacy.amountPence)
      : "";
  const oldTerm =
    legacy.paymentMode === "fixed_deposit"
      ? oldAmount
        ? `Your old ${oldAmount} deposit`
        : "Your old fixed deposit"
      : oldAmount
        ? `Your old ${oldAmount} late-cancellation amount`
        : "Your old late-cancellation setting";
  const consequence =
    pageStatus === "published"
      ? "your page isn't taking new bookings until you save a percentage"
      : "you can publish once you save a percentage";

  return (
    <Notice title="Choose a percentage" className="mt-6">
      Booking terms are now a percentage of the booking price. {oldTerm} no longer
      applies to new bookings, and {consequence}. Bookings already made keep their
      terms.
    </Notice>
  );
}

// The reference form for the dashboard: one right-aligned Save at the end.
export function BookingSettingsForm({ settings, updateBookingSettings }) {
  const [result, formAction, pending] = useActionState(updateBookingSettings, null);
  const [paymentMode, setPaymentMode] = useState(settings.payment_mode);
  const [depositPercent, setDepositPercent] = useState(settings.deposit_percent);
  const [windowHours, setWindowHours] = useState(String(settings.cancellation_window_hours));
  const fieldErrors = result?.status === "error" ? (result.fieldErrors ?? {}) : {};
  const options = percentOptions(paymentMode);

  const choosePaymentMode = (mode) => {
    setPaymentMode(mode);
    // 100% is only a full-payment choice; a deposit tops out at 90%.
    if (!percentOptions(mode).includes(Number(depositPercent))) {
      setDepositPercent("");
    }
  };

  return (
    <DashboardPage title="Booking settings">
      <LegacyNotice legacy={settings.legacy} pageStatus={settings.pageStatus} />

      <form
        id="booking_settings"
        className="mt-8 flex flex-col gap-5"
        action={formAction}
        onSubmit={keepFormValuesOnSubmit(formAction)}
        noValidate
      >
        <fieldset
          className="flex flex-col gap-1"
          aria-describedby={fieldErrors.payment_mode ? "payment_mode-error" : undefined}
        >
          <legend className="label mb-1.5">Payment when booking</legend>
          {PAYMENT_CHOICES.map((choice) => (
            <label
              key={choice.value}
              className="flex min-h-11 cursor-pointer items-start gap-3 rounded-lg py-2"
            >
              <input
                type="radio"
                name="payment_mode"
                value={choice.value}
                checked={paymentMode === choice.value}
                onChange={() => choosePaymentMode(choice.value)}
                className="mt-0.5 h-5 w-5 shrink-0 accent-pink-700"
              />
              <span className="flex flex-col">
                <span className="text-sm font-medium">{choice.label}</span>
                <span className="text-sm text-ink-muted">{choice.hint}</span>
              </span>
            </label>
          ))}
          {fieldErrors.payment_mode ? (
            <p id="payment_mode-error" className="text-sm text-danger">
              {fieldErrors.payment_mode}
            </p>
          ) : null}
        </fieldset>

        <Field
          label={paymentMode === "deposit" ? "Deposit percentage" : "Kept after a late cancellation"}
          htmlFor="deposit_percent"
          hint={paymentMode === "deposit" ? "Between 10% and 90%." : "Between 10% and 100%."}
          error={fieldErrors.deposit_percent ?? ""}
        >
          {(control) => (
            <Select
              {...control}
              name="deposit_percent"
              value={depositPercent}
              onChange={(event) => setDepositPercent(event.target.value)}
            >
              <option value="">Choose…</option>
              {options.map((percent) => (
                <option key={percent} value={String(percent)}>
                  {percent}%
                </option>
              ))}
            </Select>
          )}
        </Field>

        <Field
          label="Free cancellation until"
          htmlFor="cancellation_window_hours"
          error={fieldErrors.cancellation_window_hours ?? ""}
        >
          {(control) => (
            <Select
              {...control}
              name="cancellation_window_hours"
              value={windowHours}
              onChange={(event) => setWindowHours(event.target.value)}
            >
              <option value="12">12 hours before</option>
              <option value="24">24 hours before</option>
              <option value="48">48 hours before</option>
            </Select>
          )}
        </Field>

        <p className="rounded-lg bg-surface-subtle p-3 text-sm text-ink/80">
          <Explanation
            paymentMode={paymentMode}
            depositPercent={Number(depositPercent)}
            windowHours={windowHours}
          />
        </p>

        <Field
          label="Written booking policy"
          optional
          htmlFor="written_policy"
          hint="Shown to customers before they pay."
        >
          {(control) => (
            <Textarea
              {...control}
              name="written_policy"
              rows={6}
              className="resize-none"
              defaultValue={settings.written_policy}
            />
          )}
        </Field>

        <FormError>{result?.status === "error" ? result.message : ""}</FormError>
        <FormActions status={result?.status === "saved" && !pending ? "Saved" : ""}>
          <Button type="submit" disabled={pending} aria-busy={pending || undefined}>
            {pending ? "Saving…" : "Save"}
          </Button>
        </FormActions>
      </form>
    </DashboardPage>
  );
}
