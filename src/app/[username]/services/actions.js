"use server";
import { createClient } from "@/utils/supabase/server";

export const getTreatmentsByUsername = async (username) => {
  console.log(username);
  const supabase = createClient();
  const {
    data: { treatments },
    error,
  } = await supabase
    .from("businessprofiles")
    .select("treatments(*)")
    .eq("username", username)
    .single();

  if (error) {
    console.log({ code: error?.code, message: error?.message });
    switch (error.code) {
      default:
        return "Something went wrong.";
    }
  }

  return treatments;
};

export const getStylistProfile = async (decodedUsername) => {
  const supabase = createClient();
  const { data: stylist, error } = await supabase
    .from("businessprofiles")
    .select("*")
    .eq("username", decodedUsername)
    .single();

  if (error) {
    console.log({ code: error?.code, message: error?.message });
    switch (error.code) {
      default:
        return "Something went wrong.";
    }
  }

  return stylist;
};

export const getTreatmentById = async (treatmentId) => {
  const supabase = createClient();
  const { data: treatment, error } = await supabase
    .from("treatments")
    .select("*")
    .eq("treatment_id", treatmentId)
    .single();

  if (error) {
    console.log({ code: error?.code, message: error?.message });
    switch (error.code) {
      default:
        return "Something went wrong.";
    }
  }

  return treatment;
};
