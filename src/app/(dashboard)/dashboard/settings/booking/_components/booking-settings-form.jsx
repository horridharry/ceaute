"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { FormActions } from "@/components/ui/form-actions";
import { FormError } from "@/components/ui/form-feedback";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { keepFormValuesOnSubmit } from "@/lib/forms/keep-form-values";
import { DashboardPage } from "../../../_components/dashboard-page";

const MONEY_PATTERN = /^\d+(\.\d{1,2})?$/;

function buildExplanation(paymentMode, commitmentAmount) {
  const amount = commitmentAmount ? `£${commitmentAmount}` : "the commitment amount";

  if (paymentMode === "fixed_deposit") {
    return `Customers pay ${amount} when booking. If they cancel late, that same amount is retained.`;
  }

  return `Customers pay the full service price when booking. If they cancel late, ${amount} is retained and anything above it is refunded.`;
}

// The reference form for the dashboard: one right-aligned Save at the end.
export function BookingSettingsForm({ settings, updateBookingSettings }) {
  const [result, formAction, pending] = useActionState(updateBookingSettings, null);
  const [paymentMode, setPaymentMode] = useState(settings.payment_mode);
  const [commitmentAmount, setCommitmentAmount] = useState(settings.commitment_amount);
  const [moneyError, setMoneyError] = useState("");

  const updateCommitmentAmount = (event) => {
    const nextAmount = event.target.value.trim();
    setCommitmentAmount(nextAmount);
    setMoneyError(
      nextAmount && !MONEY_PATTERN.test(nextAmount)
        ? "Enter pounds with up to two decimal places."
        : "",
    );
  };

  return (
    <DashboardPage title="Booking settings">
      <form
        id="booking_settings"
        className="mt-8 flex flex-col gap-5"
        action={formAction}
        onSubmit={keepFormValuesOnSubmit(formAction)}
      >
        <Field label="Payment mode" htmlFor="payment_mode">
          {(control) => (
            <Select
              {...control}
              name="payment_mode"
              value={paymentMode}
              onChange={(event) => setPaymentMode(event.target.value)}
            >
              <option value="full">Full payment</option>
              <option value="fixed_deposit">Fixed deposit</option>
            </Select>
          )}
        </Field>

        <Field
          label={paymentMode === "fixed_deposit" ? "Deposit amount" : "Commitment amount"}
          htmlFor="commitment_amount"
          error={moneyError}
        >
          {(control) => (
            <span className="relative block">
              <span aria-hidden="true" className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-ink-muted">
                £
              </span>
              <Input
                {...control}
                name="commitment_amount"
                inputMode="decimal"
                className="w-full pl-7"
                value={commitmentAmount}
                onChange={updateCommitmentAmount}
              />
            </span>
          )}
        </Field>

        <Field label="Cancellation window" htmlFor="cancellation_window_hours">
          {(control) => (
            <Select
              {...control}
              name="cancellation_window_hours"
              defaultValue={settings.cancellation_window_hours}
            >
              <option value="12">12 hours</option>
              <option value="24">24 hours</option>
              <option value="48">48 hours</option>
            </Select>
          )}
        </Field>

        <p className="rounded-lg bg-surface-subtle p-3 text-sm text-ink/70">
          {buildExplanation(paymentMode, commitmentAmount)}
        </p>

        <Field label="Written booking policies" htmlFor="written_policy">
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
          <Button
            type="submit"
            disabled={pending || Boolean(moneyError)}
            aria-busy={pending || undefined}
          >
            {pending ? "Saving…" : "Save"}
          </Button>
        </FormActions>
      </form>
    </DashboardPage>
  );
}
