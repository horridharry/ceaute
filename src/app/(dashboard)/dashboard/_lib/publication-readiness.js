import { classifyStripePaymentAccount } from "@/lib/stripe/server";

function hasText(value) {
  return Boolean(String(value ?? "").trim());
}

// Each requirement, whether it is met, and the section where the provider
// meets it. The rules mirror provider_page_meets_publication_requirements,
// which PostgreSQL checks again when publishing.
function addRequirement(requirements, condition, label, href) {
  requirements.push({ label, href, met: Boolean(condition) });
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
      // The provider may have several saved locations; publication asks about
      // the one they are working from, which is what the database checks too.
      .eq("is_primary", true)
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

  const requirements = [];
  const location = locationResult.data;
  const bookingSettings = bookingSettingsResult.data;
  const paymentState = classifyStripePaymentAccount(paymentAccountResult.data);

  addRequirement(requirements, hasText(providerPage.display_name), "Business name", "/dashboard/profile");
  addRequirement(requirements, hasText(providerPage.username), "Username", "/dashboard/profile");
  addRequirement(requirements, hasText(providerPage.provider_category),
    "Provider category",
    "/dashboard/profile",
  );
  addRequirement(requirements, hasText(providerPage.biography), "Biography", "/dashboard/profile");
  addRequirement(requirements, location &&
      hasText(location.public_area) &&
      hasText(location.address_line_1) &&
      hasText(location.city) &&
      hasText(location.postcode),
    "Current location with public area and private address",
    "/dashboard/locations",
  );
  addRequirement(requirements, (availabilityResult.data ?? []).length > 0,
    "At least one enabled working day",
    "/dashboard/availability",
  );
  addRequirement(requirements, (treatmentResult.data ?? []).length > 0,
    "At least one active treatment with category, price and duration",
    "/dashboard/treatments",
  );
  addRequirement(requirements, bookingSettings &&
      ["full", "fixed_deposit"].includes(bookingSettings.payment_mode) &&
      [12, 24, 48].includes(Number(bookingSettings.cancellation_window_hours)) &&
      Number.isInteger(Number(bookingSettings.commitment_amount_pence)) &&
      Number(bookingSettings.commitment_amount_pence) >= 0,
    "Booking settings with payment and cancellation terms",
    "/dashboard/settings/booking",
  );
  addRequirement(requirements, (portfolioResult.data ?? []).length > 0,
    "At least one visible portfolio image",
    "/dashboard/profile/portfolio",
  );
  addRequirement(requirements, paymentState.state === "ready",
    "Stripe payments ready",
    "/dashboard/settings/payments",
  );

  const missing = requirements.filter((requirement) => !requirement.met);

  return {
    ready: missing.length === 0,
    missing: missing.map((requirement) => requirement.label),
    requirements,
  };
}
