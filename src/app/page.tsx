import { redirect } from "next/navigation";
import {
  getOwnedProviderPage,
  getRequestSession,
} from "@/lib/auth/request-session";

// The root is a redirect, not a page. A provider typing the bare domain is
// going to work; everyone else is shopping, and Discover says more with real
// providers on it than a landing page would.
//
// Deliberately temporary, not permanent: a marketing page will eventually want
// this URL, and a permanent redirect stays cached in browsers for a long time.
// `redirect()` from a Server Component is a 307, which is what we want.
//
// The fourth case in the design — a live hold sending the customer back to the
// booking — is not implemented: it would cost a hold lookup on every hit of
// `/`, and the wordmark points at /discover or /dashboard, so mid-booking taps
// do not come through here. Existing booking recovery is untouched.
export default async function Home() {
  const { claims } = await getRequestSession();
  const userId = claims?.sub;

  if (userId) {
    let providerPage = null;

    try {
      providerPage = await getOwnedProviderPage(userId);
    } catch {
      // A failed lookup must not strand someone on a blank root, so fall
      // through to Discover rather than guessing they have a page.
      providerPage = null;
    }

    if (providerPage) {
      redirect("/dashboard");
    }
  }

  redirect("/discover");
}
