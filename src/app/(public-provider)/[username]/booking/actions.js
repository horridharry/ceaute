"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getPublicBookingDetailsPage } from "../_lib/public-provider-data";
import { normalizePublicUsername } from "../_lib/public-provider-format";

const BOOKING_TIME_COOKIE = "ceaute_booking_time";

export async function storeSelectedBookingTime(startAt) {
  const cookieStore = await cookies();

  cookieStore.set({
    name: BOOKING_TIME_COOKIE,
    value: String(startAt),
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 15,
  });
}

export async function getSelectedBookingTime() {
  const cookieStore = await cookies();
  return cookieStore.get(BOOKING_TIME_COOKIE)?.value ?? null;
}

export async function updateBookingCustomerDetails(formData) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const profileId = data?.claims?.sub;

  if (!profileId) {
    return "Sign in to continue.";
  }

  const customerName = String(formData.get("full_name") ?? "").trim();
  const customerPhone = String(formData.get("phone") ?? "").trim();

  if (customerName.length < 2) {
    return "Enter your full name.";
  }

  if (customerName.length > 120) {
    return "Full name must be 120 characters or fewer.";
  }

  if (customerPhone.length < 7 || customerPhone.length > 20) {
    return "Enter a valid phone number.";
  }

  const { error } = await supabase
    .schema("ceaute")
    .from("profile")
    .update({
      full_name: customerName,
      phone_e164: customerPhone,
    })
    .eq("id", profileId);

  if (error) {
    return "Could not save your details.";
  }

  return "Saved.";
}

function normalizeAddOnIds(formData) {
  return formData
    .getAll("add_on")
    .map((addOnId) => String(addOnId ?? "").trim())
    .filter(Boolean);
}

function buildDetailsUrl({ username, treatmentId, startAt, addOnIds, holdId }) {
  const searchParams = new URLSearchParams({
    start_at: startAt,
  });

  for (const addOnId of addOnIds) {
    searchParams.append("add_on", addOnId);
  }

  if (holdId) {
    searchParams.set("hold", holdId);
  }

  return `/@${username}/booking/${treatmentId}/details?${searchParams.toString()}`;
}

async function saveCustomerDetails({ supabase, profileId, formData }) {
  const customerName = String(formData.get("full_name") ?? "").trim();
  const customerPhone = String(formData.get("phone") ?? "").trim();

  if (customerName.length < 2) {
    return { error: "Enter your full name." };
  }

  if (customerName.length > 120) {
    return { error: "Full name must be 120 characters or fewer." };
  }

  if (customerPhone.length < 7 || customerPhone.length > 20) {
    return { error: "Enter a valid phone number." };
  }

  const { error } = await supabase
    .schema("ceaute")
    .from("profile")
    .update({
      full_name: customerName,
      phone_e164: customerPhone,
    })
    .eq("id", profileId);

  if (error) {
    return { error: "Could not save your details." };
  }

  return {};
}

export async function createBookingHoldFromDetails(formData) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const profileId = data?.claims?.sub;
  const username = normalizePublicUsername(formData.get("username"));
  const treatmentId = String(formData.get("treatment_id") ?? "").trim();
  const startAtValue = String(formData.get("start_at") ?? "").trim();
  const addOnIds = normalizeAddOnIds(formData);
  const detailsUrl = buildDetailsUrl({
    username,
    treatmentId,
    startAt: startAtValue,
    addOnIds,
  });

  if (!profileId) {
    redirect(`/sign-in?next=${encodeURIComponent(detailsUrl)}`);
  }

  const detailsResult = await saveCustomerDetails({
    supabase,
    profileId,
    formData,
  });

  if (detailsResult.error) {
    throw new Error(detailsResult.error);
  }

  const {
    providerPage,
    treatment,
    selectedAddOns,
    availableDates,
  } = await getPublicBookingDetailsPage(username, treatmentId, addOnIds);
  const startAt = new Date(startAtValue);

  if (Number.isNaN(startAt.getTime())) {
    redirect(`/@${providerPage.username}/booking/${treatment.id}`);
  }

  const selectedSlotStillAvailable = availableDates.some((date) =>
    date.slots.some((slot) => slot.start_at === startAt.toISOString()),
  );

  if (!selectedSlotStillAvailable) {
    redirect(`/@${providerPage.username}/booking/${treatment.id}`);
  }

  const { data: holdId, error } = await supabase.schema("ceaute").rpc(
    "create_booking_hold",
    {
      target_provider_page_id: providerPage.id,
      target_treatment_id: treatment.id,
      selected_add_on_ids: selectedAddOns.map((addOn) => addOn.id),
      requested_start_at: startAt.toISOString(),
    },
  );

  if (error) {
    if (error.code === "23P01") {
      redirect(`/@${providerPage.username}/booking/${treatment.id}`);
    }

    throw new Error("Could not hold that booking time.");
  }

  redirect(
    buildDetailsUrl({
      username: providerPage.username,
      treatmentId: treatment.id,
      startAt: startAt.toISOString(),
      addOnIds: selectedAddOns.map((addOn) => addOn.id),
      holdId,
    }),
  );
}

export async function getBookingHoldSummary(bookingId) {
  const supabase = await createClient();
  const { data: summaries, error } = await supabase.schema("ceaute").rpc(
    "get_booking_hold_summary",
    {
      target_booking_id: bookingId,
    },
  );

  if (error) {
    throw new Error("Could not load booking hold.");
  }

  return summaries?.[0] ?? null;
}

export async function confirmTestBookingHold(formData) {
  if (process.env.CEAUTE_TEST_BOOKINGS_ENABLED !== "true") {
    throw new Error("Test booking confirmation is disabled.");
  }

  const supabase = await createClient();
  const bookingId = String(formData.get("booking_id") ?? "").trim();
  const returnPath = String(formData.get("return_path") ?? "").trim();
  const { data: confirmedBookingId, error } = await supabase
    .schema("ceaute")
    .rpc("confirm_test_booking_hold", {
      target_booking_id: bookingId,
    });

  if (error) {
    throw new Error("Could not confirm that booking.");
  }

  redirect(`${returnPath}&booking=${confirmedBookingId}`);
}
