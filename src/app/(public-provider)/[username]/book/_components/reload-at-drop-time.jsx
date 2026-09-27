"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

// Nothing runs at a drop time (docs/decisions/007): the booking screen is
// rendered on every request and PostgreSQL compares the drop time with its own
// clock. While the screen names the next drop, this re-renders it from the
// server shortly after that time, so the newly opened dates appear without
// the customer reloading. It renders nothing.
//
// The delay is measured from the server's clock when the page was rendered,
// not the browser's, so a wrong clock on the phone does not move it. The two
// seconds after the drop time leave room for a small difference between the
// server's clock and the database's.
const AFTER_DROP_TIME_MS = 2000;
// If the drop time has already passed but the page still named the drop as
// coming (the database's clock was a little behind the server's), keep
// checking until the dates appear. Each refresh renders a new serverNow, which
// starts this again.
const CHECK_AGAIN_MS = 5000;
// Longest delay setTimeout accepts (a signed 32-bit number of milliseconds,
// about 24 days). A later drop is left to the next page load.
const LONGEST_DELAY_MS = 2_000_000_000;

export function ReloadAtDropTime({ opensAt, serverNow }) {
  const router = useRouter();

  useEffect(() => {
    const delay = Date.parse(opensAt) - serverNow + AFTER_DROP_TIME_MS;

    if (!Number.isFinite(delay) || delay > LONGEST_DELAY_MS) {
      return undefined;
    }

    const timer = setTimeout(() => router.refresh(), delay > 0 ? delay : CHECK_AGAIN_MS);

    return () => clearTimeout(timer);
  }, [opensAt, serverNow, router]);

  return null;
}
