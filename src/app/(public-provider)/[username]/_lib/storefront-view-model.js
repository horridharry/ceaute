import { signStoragePaths } from "@/lib/supabase/signed-urls";

const PORTFOLIO_BUCKET = "portfolio-images";
const SIGNED_IMAGE_SECONDS = 60 * 60;

async function signedPortfolioImages(supabase, images) {
  const signedUrlByPath = await signStoragePaths(
    supabase,
    PORTFOLIO_BUCKET,
    images.map((image) => image.storage_path),
    SIGNED_IMAGE_SECONDS,
  );

  return images.map((image) => ({
    image_url: signedUrlByPath.get(image.storage_path) ?? "",
    caption: image.caption ?? "",
  }));
}

function mapBookingTerms(settings) {
  if (!settings) {
    return {
      payment_mode: "full",
      commitment_amount_pence: null,
      cancellation_window_hours: null,
      written_policy: "",
    };
  }

  return {
    payment_mode: settings.payment_mode,
    commitment_amount_pence: settings.commitment_amount_pence,
    cancellation_window_hours: settings.cancellation_window_hours,
    written_policy: settings.written_policy ?? "",
  };
}

function mapTreatment(treatment, compatibleAddOns) {
  return {
    id: treatment.id,
    name: treatment.name,
    description: treatment.description ?? "",
    price_pence: treatment.price_pence,
    duration_minutes: treatment.duration_minutes,
    add_ons: compatibleAddOns.map((addOn) => ({
      name: addOn.name,
      additional_price_pence: addOn.additional_price_pence,
      additional_duration_minutes: addOn.additional_duration_minutes,
    })),
  };
}

function reviewerDisplayName(profile) {
  const fullName = String(profile?.full_name ?? "").trim();

  if (!fullName) {
    return "Verified customer";
  }

  return fullName.split(/\s+/)[0] || "Verified customer";
}

function buildTreatmentSections({ treatments, groups, addOns, compatibility }) {
  const activeGroupById = new Map(groups.map((group) => [group.id, group]));
  const activeAddOnById = new Map(addOns.map((addOn) => [addOn.id, addOn]));
  const addOnIdsByTreatmentId = new Map();

  for (const item of compatibility) {
    if (!activeAddOnById.has(item.treatment_add_on_id)) {
      continue;
    }

    const ids = addOnIdsByTreatmentId.get(item.treatment_id) ?? [];
    ids.push(item.treatment_add_on_id);
    addOnIdsByTreatmentId.set(item.treatment_id, ids);
  }

  const sections = groups.map((group) => ({
    name: group.name,
    display_order: group.display_order,
    treatments: [],
  }));
  const sectionByGroupId = new Map(
    groups.map((group, index) => [group.id, sections[index]]),
  );
  const ungroupedSection = {
    name: null,
    display_order: Number.MAX_SAFE_INTEGER,
    treatments: [],
  };

  for (const treatment of treatments) {
    const compatibleAddOns = (addOnIdsByTreatmentId.get(treatment.id) ?? [])
      .map((addOnId) => activeAddOnById.get(addOnId))
      .filter(Boolean);
    const section = activeGroupById.has(treatment.treatment_group_id)
      ? sectionByGroupId.get(treatment.treatment_group_id)
      : ungroupedSection;

    section.treatments.push(mapTreatment(treatment, compatibleAddOns));
  }

  return [...sections, ungroupedSection].filter(
    (section) => section.treatments.length > 0,
  );
}

export async function buildStorefrontViewModel({ supabase, providerPage }) {
  const [
    locationResult,
    portfolioResult,
    groupsResult,
    treatmentsResult,
    addOnsResult,
    compatibilityResult,
    bookingSettingsResult,
    reviewsResult,
  ] = await Promise.all([
    supabase
      .schema("ceaute")
      .from("provider_location")
      .select("public_area")
      .eq("provider_page_id", providerPage.id)
      .maybeSingle(),
    supabase
      .schema("ceaute")
      .from("portfolio_image")
      .select("storage_path, caption, display_order, created_at")
      .eq("provider_page_id", providerPage.id)
      .eq("is_visible", true)
      .order("display_order", { ascending: true })
      .order("created_at", { ascending: true }),
    supabase
      .schema("ceaute")
      .from("treatment_group")
      .select("id, name, display_order")
      .eq("provider_page_id", providerPage.id)
      .eq("is_active", true)
      .order("display_order", { ascending: true })
      .order("name", { ascending: true }),
    supabase
      .schema("ceaute")
      .from("treatment")
      .select(
        "id, name, description, duration_minutes, price_pence, display_order, treatment_group_id, updated_at",
      )
      .eq("provider_page_id", providerPage.id)
      .eq("is_active", true)
      .order("display_order", { ascending: true })
      .order("updated_at", { ascending: false }),
    supabase
      .schema("ceaute")
      .from("treatment_add_on")
      .select(
        "id, name, additional_price_pence, additional_duration_minutes, display_order",
      )
      .eq("provider_page_id", providerPage.id)
      .eq("is_active", true)
      .order("display_order", { ascending: true })
      .order("name", { ascending: true }),
    supabase
      .schema("ceaute")
      .from("treatment_add_on_compatibility")
      .select("treatment_id, treatment_add_on_id")
      .eq("provider_page_id", providerPage.id),
    supabase
      .schema("ceaute")
      .from("provider_booking_setting")
      .select(
        "payment_mode, commitment_amount_pence, cancellation_window_hours, written_policy",
      )
      .eq("provider_page_id", providerPage.id)
      .maybeSingle(),
    supabase
      .schema("ceaute")
      .from("booking_review")
      .select("rating, comment, created_at, profile:customer_profile_id(full_name)")
      .eq("provider_page_id", providerPage.id)
      .eq("is_visible", true)
      .order("created_at", { ascending: false }),
  ]);

  if (
    locationResult.error ||
    portfolioResult.error ||
    groupsResult.error ||
    treatmentsResult.error ||
    addOnsResult.error ||
    compatibilityResult.error ||
    bookingSettingsResult.error ||
    reviewsResult.error
  ) {
    throw new Error("Could not load provider page preview.");
  }

  const portfolio = await signedPortfolioImages(
    supabase,
    portfolioResult.data ?? [],
  );

  return {
    provider: {
      business_name: providerPage.display_name ?? "",
      username: providerPage.username ?? "",
      provider_category: providerPage.provider_category ?? "",
      biography: providerPage.biography ?? "",
      public_area: locationResult.data?.public_area ?? "",
    },
    portfolio,
    treatment_sections: buildTreatmentSections({
      treatments: treatmentsResult.data ?? [],
      groups: groupsResult.data ?? [],
      addOns: addOnsResult.data ?? [],
      compatibility: compatibilityResult.data ?? [],
    }),
    booking_terms: mapBookingTerms(bookingSettingsResult.data),
    reviews: (reviewsResult.data ?? []).map((review) => ({
      rating: review.rating,
      comment: review.comment ?? "",
      created_at: review.created_at,
      reviewer_name: reviewerDisplayName(review.profile),
    })),
  };
}
