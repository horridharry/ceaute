// Pinned to the bottom of the screen. A primary that commits something — Book,
// Pay, Save, Hold — belongs here; a primary that merely navigates sits inline
// in the page.
//
// With `contextLabel` the bar becomes a row: what it costs on the left, the
// commit on the right.
export function CommitBar({ contextLabel, contextDetail, className = "", children }) {
  return (
    <div
      className={`sticky bottom-0 z-30 border-t border-black/8 bg-white px-5 pb-6 pt-3 ${className}`.trim()}
    >
      {contextLabel ? (
        <div className="flex items-center gap-4">
          <div className="flex min-w-0 flex-col">
            <span className="text-[14px] font-medium tabular-nums text-ink">
              {contextLabel}
            </span>
            {contextDetail ? (
              <span className="truncate text-[11.5px] text-black/60">
                {contextDetail}
              </span>
            ) : null}
          </div>
          <div className="ml-auto flex shrink-0 items-center gap-2">{children}</div>
        </div>
      ) : (
        children
      )}
    </div>
  );
}
