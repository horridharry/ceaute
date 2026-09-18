import Link from "next/link";
import { LinkPendingHint } from "@/components/link-pending-hint";

// A setting the provider owns: its title, what it says today, and one way to
// change it. `Edit` when the change happens in place or in a modal, a chevron
// when the row navigates to its own screen.
export function SettingRow({
  title,
  value,
  href,
  action = "navigate",
  actionLabel = "Edit",
  onEdit,
  className = "",
  children,
}) {
  const body = (
    <>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-[14px] font-medium text-ink">
          {title}
          {href ? <LinkPendingHint /> : null}
        </span>
        {value ? <span className="text-[13px] text-black/60">{value}</span> : null}
      </span>
      {action === "navigate" ? (
        <span aria-hidden="true" className="shrink-0 text-[15px] text-black/45">
          →
        </span>
      ) : null}
    </>
  );

  const rowClassName =
    `flex min-h-11 items-center gap-3 rounded-card border border-black/12 px-3.5 py-[13px] ${className}`.trim();

  if (href) {
    return (
      <Link href={href} className={`${rowClassName} transition duration-150 ease-out hover:border-black/25`}>
        {body}
      </Link>
    );
  }

  return (
    <div className={rowClassName}>
      {body}
      {children ??
        (action === "edit" ? (
          <button
            type="button"
            onClick={onEdit}
            className="shrink-0 text-[13px] font-medium text-plum transition duration-150 ease-out hover:text-plum-hover"
          >
            {actionLabel}
          </button>
        ) : null)}
    </div>
  );
}
