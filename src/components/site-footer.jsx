"use client";

import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="mt-auto bg-white">
      <div className="mx-auto flex max-w-6xl px-4 py-6 text-xs text-black/45 sm:px-6">
        <div className="flex gap-4">
          <Link href="/terms" className="font-medium hover:underline">
            Terms
          </Link>
          <Link href="/privacy" className="font-medium hover:underline">
            Privacy
          </Link>
        </div>
      </div>
    </footer>
  );
}
