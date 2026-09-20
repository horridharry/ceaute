import Link from "next/link";

export function SettingsRow({ href, children }) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between gap-4 py-4 text-sm font-medium hover:text-accent-600"
    >
      <span>{children}</span>
      <span aria-hidden="true" className="text-black/35">
        ›
      </span>
    </Link>
  );
}
