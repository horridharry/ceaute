"use client";

import Link from "next/link";

export function PublicProviderNav({ username }) {
  return (
    <section className="relative flex border-b p-3">
      <Link
        href={`/@${username}`}
        className="flex gap-1 rounded-md p-1 px-2 duration-200 hover:bg-black/10"
      >
        <p className="text-sm font-semibold">{`@${username}`}</p>
      </Link>
    </section>
  );
}
