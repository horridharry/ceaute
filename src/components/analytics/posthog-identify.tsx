"use client";

import { useEffect, useRef } from "react";
import posthog from "posthog-js";

type PosthogIdentifyProps = {
  distinctId: string | null;
  email?: string;
  name?: string;
};

// Ties the browser's PostHog identity to the signed-in Supabase user, using the
// same user id the server captures its funnel events under, so client pageviews
// and server events share one person. Mounted once in the root layout; it
// re-runs whenever the session changes. On sign-out it resets, so the next
// person on the device does not inherit the last one's identity.
export default function PosthogIdentify({
  distinctId,
  email,
  name,
}: PosthogIdentifyProps) {
  const identified = useRef(false);

  useEffect(() => {
    if (!posthog.__loaded) {
      return;
    }

    if (distinctId) {
      posthog.identify(distinctId, { email, name });
      identified.current = true;
    } else if (identified.current) {
      posthog.reset();
      identified.current = false;
    }
  }, [distinctId, email, name]);

  return null;
}
