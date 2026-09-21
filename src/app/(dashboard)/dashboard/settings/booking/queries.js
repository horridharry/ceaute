import { getSignedInProvider } from "../../_lib/provider-data";

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
