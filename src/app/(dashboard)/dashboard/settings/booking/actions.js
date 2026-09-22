"use server";

import { revalidatePath } from "next/cache";
import { meetsPositiveDepositRule } from "@/lib/payments/booking-payments";
import { getSignedInProvider } from "../../_lib/provider-data";

const PAYMENT_MODES = new Set(["full", "fixed_deposit"]);
const CANCELLATION_WINDOWS = new Set([12, 24, 48]);

function parsePoundsToPence(value) {
  const normalizedValue = String(value ?? "").trim();

  if (!normalizedValue) {
    return { value: null };
  }

  if (!/^\d+(\.\d{1,2})?$/.test(normalizedValue)) {
    return { error: "Enter a valid amount in pounds." };
  }

  const [pounds, pence = ""] = normalizedValue.split(".");
  const amountPence =
    Number(pounds) * 100 + Number(pence.padEnd(2, "0").slice(0, 2));

  if (!Number.isInteger(amountPence) || amountPence < 0) {
    return { error: "Commitment amount cannot be negative." };
  }

  return { value: amountPence };
}

// Returns { status: "saved" | "error", message } so the form can show a
// success as a neutral status and a failure as an error.
export const updateBookingSettings = async (_currentState, formData) => {
  const { supabase, providerPage } = await getSignedInProvider({
    next: "/dashboard/settings/booking",
  });

  const paymentMode = String(formData.get("payment_mode") ?? "").trim();
  const cancellationWindowHours = Number(
    formData.get("cancellation_window_hours"),
  );
  const writtenPolicy = String(formData.get("written_policy") ?? "").trim();
  const commitmentAmount = parsePoundsToPence(
    formData.get("commitment_amount"),
  );

  if (!PAYMENT_MODES.has(paymentMode)) {
    return { status: "error", message: "Choose full payment or fixed deposit." };
  }

  if (!CANCELLATION_WINDOWS.has(cancellationWindowHours)) {
    return { status: "error", message: "Choose a 12, 24, or 48 hour cancellation window." };
  }

  if (commitmentAmount.error) {
    return { status: "error", message: commitmentAmount.error };
  }

  if (
    !meetsPositiveDepositRule({
      paymentMode,
      commitmentAmountPence: commitmentAmount.value,
    })
  ) {
    return { status: "error", message: "Deposit amount must be greater than £0." };
  }

  const { error } = await supabase
    .schema("ceaute")
    .from("provider_booking_setting")
    .upsert(
      {
        provider_page_id: providerPage.id,
        payment_mode: paymentMode,
        commitment_amount_pence: commitmentAmount.value,
        cancellation_window_hours: cancellationWindowHours,
        written_policy: writtenPolicy || null,
      },
      { onConflict: "provider_page_id" },
    );

  if (error) {
    if (error.code === "23514") {
      return { status: "error", message: "Check the booking settings and try again." };
    }

    return { status: "error", message: "Could not save booking settings." };
  }

  revalidatePath("/dashboard/settings/booking");
  revalidatePath("/dashboard/settings");
  return { status: "saved", message: "Saved." };
};
