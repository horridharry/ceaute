import {
  areBookingTermsComplete,
  isLegacyBookingSetting,
} from "@/lib/payments/booking-terms";
import { getSignedInProvider } from "../../_lib/provider-data";

export const getBookingSettings = async () => {
  const { supabase, providerPage } = await getSignedInProvider({
    next: "/dashboard/settings/booking",
  });

  const { data: settings, error } = await supabase
    .schema("ceaute")
    .from("provider_booking_setting")
    .select(
      "payment_mode, deposit_percent, deposit_amount_pence, commitment_amount_pence, cancellation_window_hours, written_policy",
    )
    .eq("provider_page_id", providerPage.id)
    .maybeSingle();

  if (error) {
    throw new Error("Could not load booking settings.");
  }

  const complete = settings
    ? areBookingTermsComplete({
        paymentMode: settings.payment_mode,
        depositPercent: settings.deposit_percent,
        depositAmountPence: settings.deposit_amount_pence,
        cancellationWindowHours: settings.cancellation_window_hours,
      })
    : false;
  const legacy = isLegacyBookingSetting(settings);

  return {
    // A legacy fixed deposit lands on Deposit > Flat amount with the amount
    // empty; legacy full payment stays full payment. Nothing is pre-filled
    // from the old £ amount: the provider chooses. A new provider and a
    // full-payment provider also start on Flat amount if they pick Deposit.
    payment_mode: ["deposit", "fixed_deposit"].includes(settings?.payment_mode)
      ? "deposit"
      : "full",
    deposit_kind:
      complete && settings.payment_mode === "deposit" && settings.deposit_percent != null
        ? "percentage"
        : "flat",
    deposit_amount:
      complete && settings.deposit_amount_pence != null
        ? String(settings.deposit_amount_pence / 100)
        : "",
    deposit_percent: complete && settings.deposit_percent != null ? String(settings.deposit_percent) : "",
    cancellation_window_hours: settings?.cancellation_window_hours ?? 48,
    written_policy: settings?.written_policy ?? "",
    legacy: legacy
      ? {
          paymentMode: settings.payment_mode,
          amountPence: Number.isInteger(settings.commitment_amount_pence)
            ? settings.commitment_amount_pence
            : null,
        }
      : null,
    pageStatus: providerPage.status,
  };
};
