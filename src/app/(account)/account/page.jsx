import Link from "next/link";
import { redirect } from "next/navigation";
import { buttonClassName } from "@/components/ui/button-classes";
import { PageContainer } from "@/components/ui/page-container";
import { PageHeading } from "@/components/ui/page-heading";
import { PendingButton } from "@/components/ui/pending-button";
import { logoutUser } from "@/features/auth/logout-action";
import { getOwnedProviderPage, getRequestSession } from "@/lib/auth/request-session";
import { legalIdentity } from "@/lib/legal/identity";
import { formatUkPhoneNumber } from "@/lib/phone/normalize";
import { PersonalDetailsForm } from "./_components/personal-details-form";

function Section({ title, id, children }) {
  return (
    <section aria-labelledby={id} className="mt-10 flex flex-col gap-3 text-sm">
      <h2 id={id} className="text-xl font-semibold tracking-tight">
        {title}
      </h2>
      {children}
    </section>
  );
}

function YourBusiness({ providerPage }) {
  if (!providerPage) {
    return (
      <Section title="Your business" id="business">
        <p className="text-ink-muted">Take bookings and payments with your own page on Ceaute.</p>
        <Link href="/dashboard/onboarding" className={buttonClassName({ variant: "secondary", className: "w-max" })}>
          Start your business page
        </Link>
      </Section>
    );
  }

  return (
    <Section title="Your business" id="business">
      <div>
        <p className="font-semibold">{providerPage.display_name || `@${providerPage.username}`}</p>
        <p className="text-ink-muted">
          @{providerPage.username} · {providerPage.status === "published" ? "Published" : "Not published yet"}
        </p>
      </div>
      <Link href="/dashboard" className={buttonClassName({ variant: "secondary", className: "w-max" })}>
        Go to your business
      </Link>
    </Section>
  );
}

// Account (approved 23 September 2026): personal details, signing in, the
// way into the business side, and how to ask about your data.
export default async function AccountPage() {
  const { supabase, claims } = await getRequestSession();
  const userId = claims?.sub;

  if (!userId) {
    redirect("/sign-in?next=%2Faccount");
  }

  const [{ data: profile, error }, providerPage] = await Promise.all([
    supabase.schema("ceaute").from("profile").select("full_name, phone_e164").eq("id", userId).maybeSingle(),
    getOwnedProviderPage(userId),
  ]);

  if (error) {
    throw new Error("Could not load your details.");
  }

  const email = typeof claims?.email === "string" ? claims.email : "";

  return (
    <PageContainer>
      <PageHeading title="Account" />

      <Section title="Personal details" id="personal-details">
        <PersonalDetailsForm
          fullName={profile?.full_name ?? ""}
          phone={profile?.phone_e164 ? formatUkPhoneNumber(profile.phone_e164) : ""}
        />
      </Section>

      <Section title="Signing in" id="signing-in">
        <div>
          <p className="font-medium">{email || "Email unavailable"}</p>
          <p className="text-ink-muted">You log in with a code sent to this email. It can’t be changed here.</p>
        </div>
        <form action={logoutUser}>
          <PendingButton variant="secondary" pendingLabel="Logging out…" className="w-max">
            Log out
          </PendingButton>
        </form>
      </Section>

      <YourBusiness providerPage={providerPage} />

      <Section title="Your data" id="your-data">
        <p>
          To get a copy of your information, correct it or ask us to delete it, email{" "}
          <a href={`mailto:${legalIdentity.contactEmail}`} className="font-semibold text-accent underline-offset-2 hover:underline">
            {legalIdentity.contactEmail}
          </a>{" "}
          from the address you log in with. We reply within one month.
        </p>
        <p>
          <Link href="/privacy" className="font-semibold text-accent underline-offset-2 hover:underline">
            Privacy Notice
          </Link>
        </p>
      </Section>
    </PageContainer>
  );
}
