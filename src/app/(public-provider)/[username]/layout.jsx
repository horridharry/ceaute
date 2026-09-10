import { PublicProviderNav } from "./_components/public-provider-nav";
import { notFound } from "next/navigation";
import {
  hasPublicUsernamePrefix,
  normalizePublicUsername,
} from "./_lib/public-provider-format";

export default async function UsernameLayout({ params, children }) {
  const { username } = await params;

  if (!hasPublicUsernamePrefix(username)) {
    notFound();
  }

  const decodedUsername = normalizePublicUsername(username);

  return (
    <>
      <PublicProviderNav username={decodedUsername} />
      <div>{children}</div>
    </>
  );
}
