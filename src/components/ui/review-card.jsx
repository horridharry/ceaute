// Reviewers are shown by first name and a `/5` rating, always — the schema
// stores it that way and a marketplace of strangers should not imply more
// identity than it holds.
export function ReviewCard({
  reviewerFirstName,
  rating,
  dateLabel,
  treatmentName,
  comment,
  className = "",
}) {
  return (
    <article
      className={`flex flex-col gap-1.5 rounded-row border border-black/12 bg-white px-3.5 py-3 ${className}`.trim()}
    >
      <div className="flex items-baseline justify-between gap-3">
        <span className="truncate text-[13.5px] font-medium text-ink">
          {reviewerFirstName} · {rating}/5
        </span>
        <span className="shrink-0 text-right text-[12px] text-black/45">
          {[dateLabel, treatmentName].filter(Boolean).join(" · ")}
        </span>
      </div>
      {comment ? (
        <p className="text-[13px]/[1.5] text-black/80">{comment}</p>
      ) : null}
    </article>
  );
}
