"use client";

import { useActionState, useState } from "react";
import { FormTemplate } from "@/components/templates/form-template";
import { CommitBar } from "@/components/ui/commit-bar";
import { Field, Select, TextArea } from "@/components/ui/field";
import { InfoNotice, ProblemNotice } from "@/components/ui/notice";
import { OptionCard, OptionCardPair } from "@/components/ui/option-card";
import { SubmitButton } from "@/components/ui/submit-button";
import { StackedTopBar } from "@/components/ui/top-bar";
import { keepFormValuesOnSubmit } from "@/lib/forms/keep-form-values";

const MONEY_PATTERN = /^\d+(\.\d{1,2})?$/;

function buildExplanation(paymentMode, commitmentAmount) {
  const amount = commitmentAmount
    ? `£${commitmentAmount}`
    : "the commitment amount";

  if (paymentMode === "fixed_deposit") {
    return `Customers pay ${amount} when booking. If they cancel late, that same amount is retained.`;
  }

  return `Customers pay the full service price when booking. If they cancel late, ${amount} is retained and anything above it is refunded.`;
}

export function BookingSettingsForm({ settings, updateBookingSettings }) {
  // SubmitButton reads pending from the surrounding form.
  const [stateMessage, formAction] = useActionState(
    updateBookingSettings,
    "",
  );
  const [paymentMode, setPaymentMode] = useState(settings.payment_mode);
  const [commitmentAmount, setCommitmentAmount] = useState(
    settings.commitment_amount,
  );
  const [moneyError, setMoneyError] = useState("");

  const updateCommitmentAmount = (event) => {
    const nextAmount = event.target.value.trim();
    setCommitmentAmount(nextAmount);

    if (nextAmount && !MONEY_PATTERN.test(nextAmount)) {
      setMoneyError("Enter pounds with up to two decimal places.");
      return;
    }

    setMoneyError("");
  };

  return (
    <FormTemplate
      id="booking_settings"
      action={formAction}
      onSubmit={keepFormValuesOnSubmit(formAction)}
      nav={<StackedTopBar backHref="/dashboard/settings" backLabel="Settings" />}
      notice={
        stateMessage ? (
          <ProblemNotice title="That did not save">{stateMessage}</ProblemNotice>
        ) : null
      }
      commitBar={
        <CommitBar contextDetail="Existing bookings keep the terms they were made under.">
          <SubmitButton
            form="booking_settings"
            block={false}
            disabled={Boolean(moneyError)}
            pendingLabel="Saving"
            className="px-6"
          >
            Save terms
          </SubmitButton>
        </CommitBar>
      }
    >
      <header className="flex flex-col gap-1">
        <h1 className="text-display text-pretty text-ink">Booking terms</h1>
      </header>

      {/* Two choices that each need a line of explanation, so option cards
          rather than a select. The radios carry the same `payment_mode` value
          the action already reads. */}
      <p className="text-label uppercase text-black/45">Customers pay</p>
      <OptionCardPair>
        <OptionCard
          name="payment_mode"
          value="fixed_deposit"
          title="A fixed deposit"
          explanation="Rest on the day."
          checked={paymentMode === "fixed_deposit"}
          onChange={() => setPaymentMode("fixed_deposit")}
        />
        <OptionCard
          name="payment_mode"
          value="full"
          title="In full"
          explanation="Nothing on the day."
          checked={paymentMode === "full"}
          onChange={() => setPaymentMode("full")}
        />
      </OptionCardPair>

      <Field
        id="commitment_amount"
        label={
          paymentMode === "fixed_deposit" ? "Deposit" : "Commitment amount"
        }
        error={moneyError || undefined}
        helper={
          moneyError
            ? undefined
            : "Must be more than £0 — there's no pay-later."
        }
      >
        <div className="relative">
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 left-[13px] flex items-center text-[14px] text-black/45"
          >
            £
          </span>
          <input
            id="commitment_amount"
            name="commitment_amount"
            inputMode="decimal"
            value={commitmentAmount}
            onChange={updateCommitmentAmount}
            aria-invalid={moneyError ? true : undefined}
            className="field pl-[26px]"
          />
        </div>
      </Field>

      <Select
        name="cancellation_window_hours"
        label="Free cancellation up to"
        defaultValue={settings.cancellation_window_hours}
      >
        <option value="12">12 hours</option>
        <option value="24">24 hours</option>
        <option value="48">48 hours</option>
      </Select>

      <InfoNotice>{buildExplanation(paymentMode, commitmentAmount)}</InfoNotice>

      <TextArea
        name="written_policy"
        label="Written policy"
        optional
        rows={5}
        defaultValue={settings.written_policy}
      />
    </FormTemplate>
  );
}
