import Link from "next/link";
import { LinkPendingHint } from "@/components/link-pending-hint";
import { StatusDot } from "@/components/ui/status";

// A booking as it appears in a list: the date as a fixed 44px column so a
// stack of them reads as a column of dates, then what it is, what it costs,
// and where it stands.
export function BookingCard({
  href,
  weekdayLabel,
  dayLabel,
  title,
  amountLabel,
  meta,
  status,
  statusTone,
  statusLabel,
  className = "",
  children,
}) {
  const content = (
    <>
      <div className="flex w-11 shrink-0 flex-col">
        <span className="text-[11px] font-medium text-black/45">{weekdayLabel}</span>
        <span className="text-[19px] font-semibold tracking-[-0.02em] text-ink">
          {dayLabel}
        </span>
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-baseline justify-between gap-3">
          <span className="truncate text-body-strong text-ink">
            {title}
            <LinkPendingHint />
          </span>
          {amountLabel ? (
            <span className="shrink-0 text-body-strong tabular-nums text-ink">
              {amountLabel}
            </span>
          ) : null}
        </div>
        {meta ? <span className="text-[12.5px] text-black/50">{meta}</span> : null}
        {statusLabel ? (
          <StatusDot status={status} tone={statusTone} label={statusLabel} />
        ) : null}
        {children}
      </div>
    </>
  );

  const cardClassName =
    `flex gap-[13px] rounded-card border border-black/12 bg-white px-3.5 py-[13px] ${className}`.trim();

  if (href) {
    return (
      <Link
        href={href}
        className={`${cardClassName} transition duration-150 ease-out hover:border-black/25`}
      >
        {content}
      </Link>
    );
  }

  return <article className={cardClassName}>{content}</article>;
}
