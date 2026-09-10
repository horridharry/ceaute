import { notFound, redirect } from "next/navigation";
import {
  hasPublicUsernamePrefix,
  normalizePublicUsername,
} from "./_lib/public-provider-format";

export default async function UsernamePage({ params }) {
  const { username } = await params;

  if (!hasPublicUsernamePrefix(username)) {
    notFound();
  }

  redirect(`/@${normalizePublicUsername(username)}/services`);
}
