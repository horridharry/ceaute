"use client";

import { useLinkStatus } from "next/link";

// Fixed-size hint rendered inside a <Link>. Route-level loading.js files give
// most navigations an instant transition; this covers the slow-network case
// where the destination has not been prefetched yet. The CSS in globals.css
// delays it by 100ms so fast navigations never flash.
export function LinkPendingHint() {
  const { pending } = useLinkStatus();

  return (
    <span aria-hidden="true" className="link-hint" data-pending={pending} />
  );
}
