import { notFound } from "next/navigation";
import {
  hasPublicUsernamePrefix,
  normalizePublicUsername,
} from "./_lib/public-provider-format";

// No nav here. The storefront is a landing page reached from Discover or an
// Instagram link, and every screen beneath it is a step in the booking journey
// carrying its own stacked back control — a second bar above those would be
// two ways out of the same task.
export default async function UsernameLayout({ params, children }) {
  const { username } = await params;

  if (!hasPublicUsernamePrefix(username)) {
    notFound();
  }

  normalizePublicUsername(username);

  return <>{children}</>;
}
