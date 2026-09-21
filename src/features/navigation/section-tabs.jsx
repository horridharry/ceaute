import Link from "next/link";
import { LinkPendingHint } from "@/components/link-pending-hint";

export function SectionTabs({ ariaLabel, items, showPendingHint = true }) {
  return (
    <nav
      aria-label={ariaLabel}
      className="-mx-1 mt-5 overflow-x-auto px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      <ul className="flex min-w-max items-center gap-5 border-b border-black/10">
        {items.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              aria-current={item.active ? "page" : undefined}
              className={`block whitespace-nowrap border-b-2 pb-3 text-sm font-medium ${
                item.active
                  ? "border-pink-600 text-black"
                  : "border-transparent text-black/55 hover:text-black"
              }`}
            >
              {item.label}
              {showPendingHint ? <LinkPendingHint /> : null}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
