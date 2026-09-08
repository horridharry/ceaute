"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { validatedNextPath } from "@/lib/auth/redirect";
import { createClient } from "@/lib/supabase/server";

function authenticatePath(path, statusName, statusValue, nextValue) {
  const params = new URLSearchParams({
    [statusName]: statusValue,
  });

  if (nextValue) {
    params.set("next", nextValue);
  }

  return `${path}?${params.toString()}`;
}

async function sendSignInLink(mode, path, nextValue, formData) {
  const emailValue = formData.get("email");
  const email = typeof emailValue === "string" ? emailValue.trim() : "";
  const next = validatedNextPath(nextValue);
  const fullNameValue = formData.get("full_name");
  const fullName = typeof fullNameValue === "string" ? fullNameValue.trim() : "";

  if (!/^\S+@\S+\.\S+$/.test(email)) {
    redirect(authenticatePath(path, "error", "invalid-email", next));
  }

  if (mode === "register" && fullName.length < 2) {
    redirect(authenticatePath(path, "error", "invalid-name", next));
  }

  const requestHeaders = await headers();
  const origin = requestHeaders.get("origin");

  if (!origin) {
    redirect(authenticatePath(path, "error", "unavailable", next));
  }

  const callbackUrl = new URL("/auth/confirm", origin);
  if (next) {
    callbackUrl.searchParams.set("next", next);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      data: mode === "register" ? { full_name: fullName } : undefined,
      emailRedirectTo: callbackUrl.toString(),
      shouldCreateUser: mode === "register",
    },
  });

  if (error) {
    redirect(authenticatePath(path, "error", "unavailable", next));
  }

  redirect(authenticatePath(path, "sent", "1", next));
}

export async function authenticateUser(next, prevState, formData) {
  await sendSignInLink("login", "/sign-in", next, formData);
}

export async function createUser(next, prevState, formData) {
  await sendSignInLink("register", "/sign-up", next, formData);
}

export async function logoutUser() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/sign-in");
}

export const signOut = logoutUser;
