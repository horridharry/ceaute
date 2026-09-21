import { notFound } from "next/navigation";
import { hasPublicUsernamePrefix } from "@/features/storefront/format";

export default async function UsernameLayout({ params, children }) {
  const { username } = await params;

  if (!hasPublicUsernamePrefix(username)) {
    notFound();
  }

  return children;
}
