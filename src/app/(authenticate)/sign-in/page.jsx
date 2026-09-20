import { SigninForm } from "../_components/signin-form";
import { authenticateUser } from "../actions";
import { redirect } from "next/navigation";
import { normalizeEmail, otpRequestMessage } from "@/lib/auth/email-otp";
import { validatedNextPath } from "@/lib/auth/redirect";
import { createClient } from "@/lib/supabase/server";

export default async function SigninPage({ searchParams }) {
  const params = await searchParams;
  const next = validatedNextPath(params?.next ?? null);
  const initialEmail = normalizeEmail(params?.email);
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

  const message = otpRequestMessage("sign-in", params?.error);

  return (
    <SigninForm
      authenticateUser={authenticateUser.bind(null, next)}
      initialEmail={initialEmail}
      initialState={{ message }}
      next={next}
    />
  );
}
