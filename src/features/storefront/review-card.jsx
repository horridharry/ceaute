// One bordered review card, shared by the storefront preview and the All
// reviews page so both read the same: the rating, that the booking was
// verified, the comment, then the reviewer's first name and the date.
export function ReviewCard({ review }) {
  return (
    <article className="rounded-xl border border-black/10 p-4 text-sm">
      <div className="flex items-center justify-between gap-4">
        <p className="font-semibold">{review.rating}/5</p>
        <p className="text-xs text-black/50">Verified booking</p>
      </div>
      {review.comment ? (
        <p className="mt-3 whitespace-pre-wrap">{review.comment}</p>
      ) : null}
      <p className="mt-3 text-xs text-black/50">
        {review.reviewer_name} ·{" "}
        {new Intl.DateTimeFormat("en-GB", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        }).format(new Date(review.created_at))}
      </p>
    </article>
  );
}
