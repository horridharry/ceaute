"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
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
  const [stateMessage, formAction, pending] = useActionState(
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
    <main className="container max-w-md p-5">
      <div className="mt-6 flex flex-col">
        <h1 className="text-3xl font-bold tracking-tighter">
          Booking settings
        </h1>

        <form
          id="booking_settings"
          className="mt-12 flex flex-col gap-4"
          action={formAction}
          onSubmit={keepFormValuesOnSubmit(formAction)}
        >
          <span className="field-set">
            <label className="label" htmlFor="payment_mode">
              Payment mode
            </label>
            <select
              id="payment_mode"
              name="payment_mode"
              value={paymentMode}
              onChange={(event) => setPaymentMode(event.target.value)}
              className="field cursor-pointer"
            >
              <option value="full">Full payment</option>
              <option value="fixed_deposit">Fixed deposit</option>
            </select>
          </span>

          <span className="field-set">
            <label className="label" htmlFor="commitment_amount">
              {paymentMode === "fixed_deposit"
                ? "Deposit amount"
                : "Commitment amount"}
            </label>
            <p className="text-sm text-red-600">{moneyError}</p>
            <div className="relative flex items-center rounded-lg">
              <span className="absolute z-40 ml-3 text-sm opacity-80">£</span>
              <input
                id="commitment_amount"
                name="commitment_amount"
                inputMode="decimal"
                value={commitmentAmount}
                onChange={updateCommitmentAmount}
                className="relative w-full appearance-none rounded-lg border p-2.5 pl-8 outline-none ring-1 ring-transparent duration-200 hover:border-black/25 focus:border-plum focus:ring-plum"
              />
            </div>
          </span>

          <span className="field-set">
            <label className="label" htmlFor="cancellation_window_hours">
              Cancellation window
            </label>
            <select
              id="cancellation_window_hours"
              name="cancellation_window_hours"
              defaultValue={settings.cancellation_window_hours}
              className="field cursor-pointer"
            >
              <option value="12">12 hours</option>
              <option value="24">24 hours</option>
              <option value="48">48 hours</option>
            </select>
          </span>

          <p className="rounded-lg bg-black/5 p-3 text-sm text-black/70">
            {buildExplanation(paymentMode, commitmentAmount)}
          </p>

          <span className="field-set">
            <label className="label" htmlFor="written_policy">
              Written booking policies
            </label>
            <textarea
              id="written_policy"
              name="written_policy"
              rows={6}
              defaultValue={settings.written_policy}
              className="field resize-none"
            />
          </span>

          <p className="mt-4 text-sm text-red-600">{stateMessage}</p>

          <div className="mt-8 flex items-center justify-end gap-2">
            <Link
              href="/dashboard/settings"
              className="w-max rounded-lg border border-black/10 p-3 px-6 text-sm font-semibold text-plum duration-200 hover:border-black/20 active:border-transparent active:bg-surface active:text-plum-hover"
            >
              Back
            </Link>
            <button
              form="booking_settings"
              type="submit"
              disabled={pending || Boolean(moneyError)}
              aria-disabled={pending || Boolean(moneyError)}
              className="w-max rounded-lg bg-plum p-3 px-4 text-sm font-semibold text-white shadow-sm duration-200 hover:bg-plum-hover disabled:cursor-not-allowed disabled:opacity-60 aria-disabled:cursor-not-allowed aria-disabled:opacity-50"
            >
              {pending ? "Saving..." : "Save"}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
