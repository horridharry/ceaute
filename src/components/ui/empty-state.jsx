// What a list or page says when it has nothing to show. inline is a line of
// muted text; bounded puts the same text in a card. The wording belongs to
// the screen; keep it plain, with an action only when one helps.
import { emptyStateClassName } from "./layout-classes";

export function EmptyState({
  as = null,
  variant = "inline",
  border = "line",
  action = null,
  className = "",
  children,
}) {
  const Element = as ?? (action ? "div" : "p");
  const classes = emptyStateClassName({ variant, border, className });

  if (!action) {
    return <Element className={classes}>{children}</Element>;
  }

  return (
    <Element className={classes}>
      <p>{children}</p>
      <div className="mt-3">{action}</div>
    </Element>
  );
}
