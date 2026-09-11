"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  getPublicTreatmentForProvider,
  getPublishedProviderPageByUsername,
} from "../_lib/public-provider-data";

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

export async function createBookingForSelectedTime({
  username,
  treatmentId,
  formData,
}) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const customerProfileId = data?.claims?.sub;
  const nextPath = `/@${username}/booking/${treatmentId}/details`;

  if (!customerProfileId) {
    redirect(`/sign-in?next=${encodeURIComponent(nextPath)}`);
  }

  const providerPage = await getPublishedProviderPageByUsername(username);
  const treatment = await getPublicTreatmentForProvider(
    providerPage.id,
    treatmentId,
  );
  const selectedBookingTime = await getSelectedBookingTime();

  if (!selectedBookingTime) {
    redirect(`/@${providerPage.username}/booking/${treatment.id}`);
  }

  const startAt = new Date(selectedBookingTime);
  if (Number.isNaN(startAt.getTime())) {
    redirect(`/@${providerPage.username}/booking/${treatment.id}`);
  }

  const endAt = new Date(
    startAt.getTime() + treatment.duration_minutes * 60_000,
  );

  const customerName = String(formData.get("customer_fullname") ?? "").trim();
  const customerEmail = String(formData.get("customer_email") ?? "").trim();
  const customerPhone = String(formData.get("customer_mobile") ?? "").trim();

  if (!customerName || !customerEmail || !customerPhone) {
    throw new Error("Please complete your booking details.");
  }

  const { data: booking, error } = await supabase
    .schema("ceaute")
    .from("booking")
    .insert({
      customer_profile_id: customerProfileId,
      provider_page_id: providerPage.id,
      treatment_id: treatment.id,
      start_at: startAt.toISOString(),
      end_at: endAt.toISOString(),
      status: "confirmed",
      customer_snapshot: {
        name: customerName,
        email: customerEmail,
        phone: customerPhone,
      },
      service_snapshot: {
        provider_display_name: providerPage.display_name,
        provider_username: providerPage.username,
        treatment_name: treatment.name,
        treatment_description: treatment.description,
        duration_minutes: treatment.duration_minutes,
        price_pence: treatment.price_pence,
      },
    })
    .select("id")
    .single();

  if (error) {
    throw new Error("Could not create booking.");
  }

  redirect(`/account?booking=${booking.id}`);
}
