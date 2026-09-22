import { normalizePublicUsername } from "@/features/storefront/format";
import { getPublishedProviderPageByUsername } from "../_lib/public-provider-data";

// The storefront's published-page check runs here, outside this group's
// loading.jsx Suspense boundary, so a missing or unpublished provider is
// known before anything streams and the response can still be a real 404.
// After a fallback has streamed, Next.js can only mark the page noindex with
// a 200. The lookup is cached per request, so the page and its metadata
// reuse it.
//
// The check deliberately does not cover /book: checkout for an existing hold
// or booking (including Stripe's success and cancel returns) must keep
// working after the provider is unpublished or suspended.
export default async function StorefrontLayout({ params, children }) {
  const { username } = await params;

  await getPublishedProviderPageByUsername(normalizePublicUsername(username));

  return children;
}
