// One managed item in a list (an add-on, a treatment group, a location): the
// row is a link to edit it, and its other actions sit beside that link in an
// ActionMenu. The menu is a sibling, never inside the link, so each has its
// own focus stop and name.
import Link from "next/link";

export function ManagementRow({ href, name, meta = [], badge = null, archived = false, menu }) {
  return (
    <li className="flex items-stretch rounded-xl border border-line bg-surface">
      <Link
        href={href}
        className="flex min-w-0 flex-1 flex-col gap-1 rounded-l-xl py-3.5 pl-4 pr-1 hover:bg-ink/[0.02] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
      >
        <span className="flex flex-wrap items-center gap-2">
          <span
            className={`text-[15px] font-semibold [overflow-wrap:anywhere] ${
              archived ? "text-ink-muted" : ""
            }`}
          >
            {name}
          </span>
          {badge}
        </span>
        {meta.filter(Boolean).map((line) => (
          <span key={line} className="text-[13px] tabular-nums text-ink-muted">
            {line}
          </span>
        ))}
      </Link>
      <div className="flex items-start py-1.5 pr-1.5">{menu}</div>
    </li>
  );
}
