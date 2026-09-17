import { redirect } from "next/navigation";
import {
  getOwnedProviderPage,
  getRequestSession,
} from "@/lib/auth/request-session";

const DAYS_BY_NAME = {
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
  sunday: 0,
};

const NAMES_BY_DAY = Object.fromEntries(
  Object.entries(DAYS_BY_NAME).map(([name, value]) => [value, name]),
);

export function minutesToDuration(minutes) {
  const safeMinutes = Number.isFinite(Number(minutes)) ? Number(minutes) : 0;
  const hours = Math.floor(safeMinutes / 60);
  const remainingMinutes = safeMinutes % 60;

  return `00:${String(hours).padStart(2, "0")}:${String(remainingMinutes).padStart(2, "0")}`;
}

export function durationToMinutes(value) {
  const minutes = Number(value);

  if (Number.isInteger(minutes)) {
    return minutes;
  }

  if (typeof value !== "string") {
    return 0;
  }

  const parts = value.split(":").map((part) => Number(part));
  if (parts.length < 3 || parts.some((part) => !Number.isFinite(part))) {
    return 0;
  }

  return parts[1] * 60 + parts[2];
}

// Pounds entered as "12" or "12.50" become whole pence. Returns null when the
// text is not a price at all, which callers report as a validation error.
export function nonNegativePriceToPence(value) {
  const normalizedValue = String(value ?? "").trim();

  if (!/^\d+(\.\d{1,2})?$/.test(normalizedValue)) {
    return null;
  }

  const [pounds, pence = ""] = normalizedValue.split(".");
  const pricePence =
    Number(pounds) * 100 + Number(pence.padEnd(2, "0").slice(0, 2));

  return Number.isInteger(pricePence) && pricePence >= 0 ? pricePence : null;
}

// Treatments must cost something, so zero is rejected as well.
export function priceToPence(value) {
  const pricePence = nonNegativePriceToPence(value);

  return pricePence ? pricePence : null;
}

export function penceToPrice(value) {
  const pence = Number(value);
  return Number.isFinite(pence) ? pence / 100 : 0;
}

export function minutesToDurationParts(minutes) {
  const safeMinutes = Number.isFinite(Number(minutes)) ? Number(minutes) : 0;

  return {
    hours: Math.floor(safeMinutes / 60),
    minutes: safeMinutes % 60,
  };
}

export function formatDurationMinutes(minutes) {
  const { hours, minutes: remainingMinutes } = minutesToDurationParts(minutes);

  return [hours ? `${hours} hours` : "", remainingMinutes ? `${remainingMinutes} minutes` : ""]
    .filter(Boolean)
    .join(" ");
}

export { normalizeUsername } from "./username";

export function weekdayNameToNumber(name) {
  return DAYS_BY_NAME[name] ?? null;
}

export function weekdayNumberToName(day) {
  return NAMES_BY_DAY[day] ?? null;
}

// Session verification and the provider-page lookup are memoised per render
// (see request-session.js), so a page whose helpers each call this still pays
// for one claims check and one provider_page query.
export async function getSignedInProvider({ next = "/dashboard" } = {}) {
  const { supabase, claims } = await getRequestSession();
  const userId = claims?.sub;

  if (!userId) {
    redirect(`/sign-in?next=${encodeURIComponent(next)}`);
  }

  const providerPage = await getOwnedProviderPage(userId);

  if (!providerPage) {
    redirect("/dashboard/onboarding");
  }

  return {
    supabase,
    user: {
      id: userId,
      name: claims.user_metadata?.full_name ?? "",
      email: claims.email ?? "",
    },
    providerPage,
  };
}

export function providerPageToFormValues(providerPage) {
  return {
    providerPageId: providerPage.id,
    userId: providerPage.owner_profile_id,
    username: providerPage.username ?? "",
    businessName: providerPage.display_name ?? "",
    providerCategory: providerPage.provider_category ?? "",
    biography: providerPage.biography ?? "",
    status: providerPage.status,
  };
}

export function treatmentToProviderTreatment(treatment) {
  const durationMinutes = Number(treatment.duration_minutes ?? 0);

  return {
    treatmentId: treatment.id,
    providerPageId: treatment.provider_page_id,
    name: treatment.name,
    description: treatment.description ?? "",
    price: penceToPrice(treatment.price_pence),
    price_pence: treatment.price_pence,
    duration: minutesToDuration(durationMinutes),
    duration_minutes: durationMinutes,
    discovery_category_id: treatment.discovery_category_id ?? "",
    discovery_category_name: treatment.discovery_category?.name ?? "",
    treatment_group_id: treatment.treatment_group_id ?? "",
    treatment_group_name: treatment.treatment_group?.name ?? "",
    is_active: Boolean(treatment.is_active),
    image_url: treatment.image_url ?? "",
    updated_at: treatment.updated_at,
  };
}
