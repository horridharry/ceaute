import { classifyStripePaymentAccount } from "@/lib/stripe/server";

function hasText(value) {
  return Boolean(String(value ?? "").trim());
}

function addMissing(missing, condition, label) {
  if (!condition) {
    missing.push(label);
  }
}

export async function getProviderPagePublicationReadiness({
  supabase,
  providerPage,
}) {
  const [
    locationResult,
    availabilityResult,
    treatmentResult,
    bookingSettingsResult,
    portfolioResult,
    paymentAccountResult,
  ] = await Promise.all([
    supabase
      .schema("ceaute")
      .from("provider_location")
      .select("public_area, address_line_1, city, postcode, is_active")
      .eq("provider_page_id", providerPage.id)
      .eq("is_active", true)
      .maybeSingle(),
    supabase
      .schema("ceaute")
      .from("availability_rule")
      .select("id")
      .eq("provider_page_id", providerPage.id)
      .limit(1),
    supabase
      .schema("ceaute")
      .from("treatment")
      .select("id")
      .eq("provider_page_id", providerPage.id)
      .eq("is_active", true)
      .not("discovery_category_id", "is", null)
      .gt("price_pence", 0)
      .gt("duration_minutes", 0)
      .limit(1),
    supabase
      .schema("ceaute")
      .from("provider_booking_setting")
      .select(
        "payment_mode, commitment_amount_pence, cancellation_window_hours",
      )
      .eq("provider_page_id", providerPage.id)
      .maybeSingle(),
    supabase
      .schema("ceaute")
      .from("portfolio_image")
      .select("id")
      .eq("provider_page_id", providerPage.id)
      .eq("is_visible", true)
      .limit(1),
    supabase
      .schema("ceaute")
      .from("provider_payment_account")
      .select(
        "stripe_account_id, recipient_applied, stripe_transfers_status, payouts_status, requirements_currently_due, requirements_past_due",
      )
      .eq("provider_page_id", providerPage.id)
      .maybeSingle(),
  ]);

  if (
    locationResult.error ||
    availabilityResult.error ||
    treatmentResult.error ||
    bookingSettingsResult.error ||
    portfolioResult.error ||
    paymentAccountResult.error
  ) {
    throw new Error("Could not check publication readiness.");
  }

  const missing = [];
  const location = locationResult.data;
  const bookingSettings = bookingSettingsResult.data;
  const paymentState = classifyStripePaymentAccount(paymentAccountResult.data);

  addMissing(missing, hasText(providerPage.display_name), "Business name");
  addMissing(missing, hasText(providerPage.username), "Username");
  addMissing(
    missing,
    hasText(providerPage.provider_category),
    "Provider category",
  );
  addMissing(missing, hasText(providerPage.biography), "Biography");
  addMissing(
    missing,
    location &&
      hasText(location.public_area) &&
      hasText(location.address_line_1) &&
      hasText(location.city) &&
      hasText(location.postcode),
    "Active location with public area and private address",
  );
  addMissing(
    missing,
    (availabilityResult.data ?? []).length > 0,
    "At least one enabled working day",
  );
  addMissing(
    missing,
    (treatmentResult.data ?? []).length > 0,
    "At least one active treatment with category, price and duration",
  );
  addMissing(
    missing,
    bookingSettings &&
      ["full", "fixed_deposit"].includes(bookingSettings.payment_mode) &&
      [12, 24, 48].includes(Number(bookingSettings.cancellation_window_hours)) &&
      Number.isInteger(Number(bookingSettings.commitment_amount_pence)) &&
      Number(bookingSettings.commitment_amount_pence) >= 0,
    "Booking settings with payment and cancellation terms",
  );
  addMissing(
    missing,
    (portfolioResult.data ?? []).length > 0,
    "At least one visible portfolio image",
  );
  addMissing(
    missing,
    paymentState.state === "ready",
    "Stripe payments ready",
  );

  return {
    ready: missing.length === 0,
    missing,
  };
}
