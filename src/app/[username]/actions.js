"use server";

import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/dist/server/api-utils";

const supabase = createClient();

export const getTreatments = async (username) => {
  let decodedUsername = String(username);
  const { data: profile } = await supabase
    .from("profiles")
    .select("*, treatments(*)")
    .eq("username", decodedUsername)
    .single();

  console.log(profile);
  console.log(typeof username);
  console.log(typeof "username");

  return profile;
};

export const getSchedule = async (username) => {
  let decodedUsername = String(username);
  const { data: profile } = await supabase
    .from("profiles")
    .select("*, schedules(*)")
    .eq("username", decodedUsername)
    .single();

  console.log(profile);

  return profile;
};

export async function createBooking(
  { dateTime, treatmentId, username },
  formData
) {
  console.log(dateTime, treatmentId, username);
  const bookingDetails = {
    full_name: formData.get("fullName"),
    email_address: formData.get("emailAddress"),
    phone_number: formData.get("phoneNumber"),
    FK_treatment: treatmentId,
    UQ_profile_username: username,
    booking_date: dateTime,
    booking_date_tz: dateTime,
    booking_status: "active",
  };

  const { error } = await supabase.from("bookings").insert(bookingDetails);

  if (error) {
    console.error("Error creating booking:", error);
    // Handle error appropriately, e.g., display an error message
  } else {
    console.log("success");
    redirect("/confirm");
    // Handle success, e.g., redirect to a confirmation page
  }
}
