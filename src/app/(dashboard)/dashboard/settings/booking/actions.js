"use server";

import { revalidatePath } from "next/cache";
import { parseBookingTermsForm } from "@/lib/payments/booking-terms";
import { getSignedInProvider } from "../../_lib/provider-data";

// Returns { status: "saved" | "error", message, fieldErrors } so the form can
// show a success as a neutral status, a failure as an error, and each
// invalid field beside itself.
export const updateBookingSettings = async (_currentState, formData) => {
  const { supabase, providerPage } = await getSignedInProvider({
    next: "/dashboard/settings/booking",
  });

  const parsed = parseBookingTermsForm({
    paymentMode: formData.get("payment_mode"),
    depositKind: formData.get("deposit_kind"),
    depositPercent: formData.get("deposit_percent"),
    depositAmount: formData.get("deposit_amount"),
    cancellationWindowHours: formData.get("cancellation_window_hours"),
    writtenPolicy: formData.get("written_policy"),
  });

  if (parsed.errors) {
    return {
      status: "error",
      message: "Check the highlighted settings.",
      fieldErrors: parsed.errors,
    };
  }

  // PostgreSQL refuses anything that is not complete booking terms
  // (provider_booking_setting_percentage_terms), so this write is the rule.
  const { error } = await supabase
    .schema("ceaute")
    .from("provider_booking_setting")
    .upsert(
      { provider_page_id: providerPage.id, ...parsed.values },
      { onConflict: "provider_page_id" },
    );

  if (error) {
    if (error.code === "23514") {
      return {
        status: "error",
        message: "Those booking terms can't be saved. Check your booking terms and try again.",
        fieldErrors: {},
      };
    }

    return { status: "error", message: "Could not save booking settings.", fieldErrors: {} };
  }

  revalidatePath("/dashboard", "layout");
  return { status: "saved", message: "Saved.", fieldErrors: {} };
};
