import { getRequestSession } from "@/lib/auth/request-session";
import PosthogIdentify from "./posthog-identify";

// Reads the signed-in user's claims and hands them to the client identifier.
// Kept as its own async server component so the root layout stays synchronous:
// this session read is cached per request (shared with the header) and resolves
// alongside the rest of the tree instead of gating it, so anonymous public
// pages pay nothing for it.
export default async function PosthogUser() {
  const { claims } = await getRequestSession();

  return (
    <PosthogIdentify
      distinctId={claims?.sub ?? null}
      email={claims?.email ?? undefined}
      name={
        claims?.user_metadata?.full_name ??
        claims?.user_metadata?.name ??
        undefined
      }
    />
  );
}
