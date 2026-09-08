import { SignupForm } from "../components/signup-form";
import { createUser } from "../actions";
import { redirect } from "next/navigation";
import { validatedNextPath } from "@/lib/auth/redirect";
import { createClient } from "@/lib/supabase/server";

export default async function SignupPage({ searchParams }) {
  const params = await searchParams;
  const next = validatedNextPath(params?.next ?? null);
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();

  if (data?.claims?.sub) {
    if (next) {
      redirect(next);
    }

    const { data: providerPage, error } = await supabase
      .schema("ceaute")
      .from("provider_page")
      .select("id")
      .eq("owner_profile_id", data.claims.sub)
      .maybeSingle();

    if (error) {
      throw new Error("Could not choose your sign-in destination.");
    }

    redirect(providerPage ? "/provider" : "/account");
  }

  const message =
    params?.sent === "1"
      ? "Check your email. Use the secure link to finish creating your account."
      : params?.error === "invalid-email"
        ? "Enter a valid email address."
        : params?.error === "invalid-name"
          ? "Enter your full name."
          : params?.error
            ? "We could not create your account. Check the details and try again."
            : "";

  return (
    <SignupForm
      createUser={createUser.bind(null, next)}
      initialState={{ message }}
      next={next}
    />
  );
}
