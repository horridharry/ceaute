"use server";
import { createClient } from "@/utils/supabase/server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export async function storeInCookies(name, value) {
  cookies().set({
    name: name,
    value: value,
    httpOnly: true,
    path: "/",
  });
}

export async function getAllCookies() {
  const cookieStore = cookies();

  const booking_time = cookieStore.get("booking_time");
  const customer_name = cookieStore.get("customer_name");
  const customer_email = cookieStore.get("customer_email");
  const customer_mobile = cookieStore.get("customer_mobile");

  const bookingDetails = {
    booking_time: booking_time.value,
    customer_name: customer_name.value,
    customer_email: customer_email.value,
    customer_mobile: customer_mobile.value,
  };

  return cookies();
}
export const getTreatmentById = async (treatmentId) => {
  const supabase = createClient();

  const { data: treatment, error } = await supabase
    .from("treatments")
    .select("*")
    .eq("treatment_id", treatmentId)
    .single();

  if (error) {
    throw new Error(error);
  }

  return treatment;
};

export const getAvailabilityByUsername = async (username) => {
  const supabase = createClient();
  const {
    data: { schedules: schedule },
    error,
  } = await supabase
    .from("businessprofiles")
    .select("schedules(*)")
    .eq("username", username)
    .single();

  if (error) {
    throw new Error(error);
  }

  return schedule;
};

export const createBooking = async (bookingDetails) => {
  const supabase = createClient();

  const { data: bookingData, error: bookingError } = await supabase
    .from("bookings")
    .insert(bookingDetails)
    .select()
    .single();

  if (bookingError) {
    console.error(bookingError);
  }

  redirect(`/appointments/${bookingData.booking_id}`);
};
