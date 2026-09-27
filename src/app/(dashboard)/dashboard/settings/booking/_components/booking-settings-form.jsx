"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { FormActions } from "@/components/ui/form-actions";
import { FormError } from "@/components/ui/form-feedback";
import { Input } from "@/components/ui/input";
import { Notice } from "@/components/ui/notice";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { keepFormValuesOnSubmit } from "@/lib/forms/keep-form-values";
import { bookingTermsExample, percentOptions } from "@/lib/payments/booking-terms";
import { formatPricePence } from "@/features/storefront/format";
import { DashboardPage } from "../../../_components/dashboard-page";

const PAYMENT_CHOICES = [
  { value: "deposit", label: "Deposit", hint: "Customers pay a deposit when they book and the rest at the appointment." },
  { value: "full", label: "Full payment", hint: "Customers pay the whole price when they book." },
];

const DEPOSIT_KIND_CHOICES = [
  { value: "flat", label: "Flat amount" },
  { value: "percentage", label: "Percentage" },
];

// The typed flat amount in pence, only when it is whole pounds of at least £1.
// A leading £ is ignored, as the save does.
function flatAmountPence(depositAmount) {
  const text = String(depositAmount ?? "").trim().replace(/^£/, "").trim();

  if (!/^\d+$/.test(text) || Number(text) < 1) {
    return null;
  }

  return Number(text) * 100;
}

// What the chosen terms mean, in words and on a £40.00 booking. Every allowed
// percentage of £40 is a whole number of pence, so nothing here rounds.
function Explanation({ paymentMode, depositKind, depositPercent, depositAmountPence, windowHours }) {
  if (paymentMode === "deposit" && depositKind === "flat") {
    const flatExample = bookingTermsExample({ paymentMode, depositKind, depositAmountPence });

    if (!flatExample) {
      return "Enter a deposit amount to see what customers pay.";
    }

    const amount = formatPricePence(flatExample.flatPence);

    return (
      <>
        Customers pay {amount} when they book. The rest is paid to you at the
        appointment. If they cancel less than {windowHours} hours before, you keep
        the {amount}.
        <span className="mt-1 block text-ink-muted">
          On a {formatPricePence(flatExample.pricePence)} booking:{" "}
          {formatPricePence(flatExample.payNowPence)} now,{" "}
          {formatPricePence(flatExample.laterPence)} at the appointment.
        </span>
        <span className="mt-1 block text-ink-muted">
          If a booking costs less than {amount}, they pay the whole price when they
          book.
        </span>
      </>
    );
  }

  const example = bookingTermsExample({ paymentMode, depositKind, depositPercent });

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

// Settings saved before decision 006 are kept, not converted, and no
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
      ? "your page isn’t taking new bookings until you save your terms"
      : "you can publish once you save your terms";

  return (
    <Notice title="Choose your booking terms" className="mt-6">
      {oldTerm} no longer applies to new bookings, and {consequence}. Bookings
      already made keep their terms.
    </Notice>
  );
}

// The reference form for the dashboard: one right-aligned Save at the end.
export function BookingSettingsForm({ settings, updateBookingSettings }) {
  const [result, formAction, pending] = useActionState(updateBookingSettings, null);
  const [paymentMode, setPaymentMode] = useState(settings.payment_mode);
  const [depositKind, setDepositKind] = useState(settings.deposit_kind);
  const [depositPercent, setDepositPercent] = useState(settings.deposit_percent);
  const [depositAmount, setDepositAmount] = useState(settings.deposit_amount);
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

        {paymentMode === "deposit" ? (
          <fieldset
            className="flex flex-col gap-1"
            aria-describedby={fieldErrors.deposit_kind ? "deposit_kind-error" : undefined}
          >
            <legend className="sr-only">Deposit</legend>
            {DEPOSIT_KIND_CHOICES.map((choice) => (
              <label
                key={choice.value}
                className="flex min-h-11 cursor-pointer items-start gap-3 rounded-lg py-2"
              >
                <input
                  type="radio"
                  name="deposit_kind"
                  value={choice.value}
                  checked={depositKind === choice.value}
                  onChange={() => setDepositKind(choice.value)}
                  className="mt-0.5 h-5 w-5 shrink-0 accent-pink-700"
                />
                <span className="text-sm font-medium">{choice.label}</span>
              </label>
            ))}
            {fieldErrors.deposit_kind ? (
              <p id="deposit_kind-error" className="text-sm text-danger">
                {fieldErrors.deposit_kind}
              </p>
            ) : null}
          </fieldset>
        ) : null}

        {paymentMode === "deposit" && depositKind === "flat" ? (
          <Field
            label="Deposit amount"
            htmlFor="deposit_amount"
            hint="Whole pounds, at least £1. The same for every treatment."
            error={fieldErrors.deposit_amount ?? ""}
          >
            {(control) => (
              <span className="relative block">
                <span aria-hidden="true" className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-ink-muted">
                  £
                </span>
                <Input
                  {...control}
                  type="text"
                  name="deposit_amount"
                  inputMode="numeric"
                  className="w-full pl-7"
                  value={depositAmount}
                  onChange={(event) => setDepositAmount(event.target.value)}
                />
              </span>
            )}
          </Field>
        ) : null}

        {paymentMode === "full" || depositKind === "percentage" ? (
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
        ) : null}

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
            depositKind={depositKind}
            depositPercent={Number(depositPercent)}
            depositAmountPence={flatAmountPence(depositAmount)}
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
