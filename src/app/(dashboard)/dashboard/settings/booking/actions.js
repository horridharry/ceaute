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

function penceToPounds(value) {
  const amountPence = Number(value);

  if (!Number.isInteger(amountPence)) {
    return "";
  }

  return (amountPence / 100).toFixed(2);
}

export const getBookingSettings = async () => {
  const { supabase, providerPage } = await getSignedInProvider({
    next: "/dashboard/settings/booking",
  });

  const { data: settings, error } = await supabase
    .schema("ceaute")
    .from("provider_booking_setting")
    .select(
      "payment_mode, commitment_amount_pence, cancellation_window_hours, written_policy",
    )
    .eq("provider_page_id", providerPage.id)
    .maybeSingle();

  if (error) {
    throw new Error("Could not load booking settings.");
  }

  return {
    payment_mode: settings?.payment_mode ?? "full",
    commitment_amount: penceToPounds(settings?.commitment_amount_pence),
    cancellation_window_hours: settings?.cancellation_window_hours ?? 48,
    written_policy: settings?.written_policy ?? "",
  };
};

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
    return "Choose full payment or fixed deposit.";
  }

  if (!CANCELLATION_WINDOWS.has(cancellationWindowHours)) {
    return "Choose a 12, 24, or 48 hour cancellation window.";
  }

  if (commitmentAmount.error) {
    return commitmentAmount.error;
  }

  if (
    !meetsPositiveDepositRule({
      paymentMode,
      commitmentAmountPence: commitmentAmount.value,
    })
  ) {
    return "Deposit amount must be greater than £0.";
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
      return "Check the booking settings and try again.";
    }

    return "Could not save booking settings.";
  }

  revalidatePath("/dashboard/settings/booking");
  revalidatePath("/dashboard/settings");
  return "Saved.";
};
