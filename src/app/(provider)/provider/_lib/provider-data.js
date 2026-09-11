import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

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

export function priceToPence(value) {
  const normalizedValue = String(value ?? "").trim();

  if (!/^\d+(\.\d{1,2})?$/.test(normalizedValue)) {
    return null;
  }

  const [pounds, pence = ""] = normalizedValue.split(".");
  const pricePence =
    Number(pounds) * 100 + Number(pence.padEnd(2, "0").slice(0, 2));

  if (!Number.isInteger(pricePence) || pricePence <= 0) {
    return null;
  }

  return pricePence;
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

export function normalizeUsername(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._]+/g, "")
    .slice(0, 30);
}

export function weekdayNameToNumber(name) {
  return DAYS_BY_NAME[name] ?? null;
}

export function weekdayNumberToName(day) {
  return NAMES_BY_DAY[day] ?? null;
}

export async function getSignedInProvider({ next = "/provider" } = {}) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;

  if (!userId) {
    redirect(`/sign-in?next=${encodeURIComponent(next)}`);
  }

  const { data: providerPage, error } = await supabase
    .schema("ceaute")
    .from("provider_page")
    .select("id, owner_profile_id, username, display_name, provider_category, biography, status")
    .eq("owner_profile_id", userId)
    .maybeSingle();

  if (error) {
    throw new Error("Could not load provider workspace.");
  }

  if (!providerPage) {
    redirect("/provider/onboarding");
  }

  return {
    supabase,
    user: {
      id: userId,
      name: data.claims.user_metadata?.full_name ?? "",
      email: data.claims.email ?? "",
    },
    providerPage,
  };
}

export function providerPageToProviderProfile(providerPage) {
  return {
    profile_id: providerPage.id,
    user_id: providerPage.owner_profile_id,
    username: providerPage.username ?? "",
    business_name: providerPage.display_name ?? "",
    provider_category: providerPage.provider_category ?? "",
    biography: providerPage.biography ?? "",
    status: providerPage.status,
  };
}

export function treatmentToProviderTreatment(treatment) {
  const durationMinutes = Number(treatment.duration_minutes ?? 0);

  return {
    treatment_id: treatment.id,
    profile_id: treatment.provider_page_id,
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
