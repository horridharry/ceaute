"use server";

import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";

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
