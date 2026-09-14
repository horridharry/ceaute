import { SigninForm } from "../_components/signin-form";
import { authenticateUser } from "../actions";
import { redirect } from "next/navigation";
import { validatedNextPath } from "@/lib/auth/redirect";
import { createClient } from "@/lib/supabase/server";

export default async function SigninPage({ searchParams }) {
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

    redirect(providerPage ? "/dashboard" : "/account");
  }

  const message =
    params?.sent === "1"
      ? "Check your email. Use the secure link we sent to continue."
      : params?.error === "invalid-email"
        ? "Enter a valid email address."
        : params?.error
          ? "We could not sign you in. Check the email or create an account."
          : "";

  return (
    <SigninForm
      authenticateUser={authenticateUser.bind(null, next)}
      initialState={{ message }}
      next={next}
    />
  );
}
