import Link from "next/link";

// Treatment rows are filled so they read as tappable products; every other row
// in the product is outlined. The right-hand side holds one button and nothing
// else — an earlier version stacked price, duration and a link there and it
// read as clutter.
//
// The description does not appear on the row. It lives in the detail modal.
//
// The whole row opens the detail; the pill selects. They are two real buttons
// rather than one nested inside the other, with the row's button stretched
// behind the pill, so both are reachable by keyboard and announce themselves.
export function TreatmentRow({
  name,
  meta,
  selectLabel = "Select",
  onOpenDetails,
  onSelect,
  detailsHref,
  selectHref,
  className = "",
}) {
  const pillClassName =
    "relative shrink-0 rounded-full bg-ink px-3.5 py-[9px] text-[12.5px] font-semibold text-white transition duration-150 ease-out hover:bg-ink/90";

  return (
    <div
      className={`relative flex items-center gap-3 rounded-row bg-surface px-3.5 py-[13px] ${className}`.trim()}
    >
      {detailsHref ? (
        <Link
          href={detailsHref}
          aria-label={`View ${name}`}
          className="absolute inset-0 rounded-row"
        />
      ) : (
        <button
          type="button"
          onClick={onOpenDetails}
          aria-label={`View ${name}`}
          className="absolute inset-0 rounded-row"
        />
      )}

      <div className="pointer-events-none relative flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate text-body-strong text-ink">{name}</span>
        {meta ? <span className="text-[12.5px] text-black/60">{meta}</span> : null}
      </div>

      {selectHref ? (
        <Link href={selectHref} className={pillClassName}>
          {selectLabel}
        </Link>
      ) : (
        <button type="button" onClick={onSelect} className={pillClassName}>
          {selectLabel}
        </button>
      )}
    </div>
  );
}
