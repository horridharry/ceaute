// A page's single <h1>, with an optional way back, description and action.
// Use it once per page; section titles below it are <h2>s.
import Link from "next/link";
import { composeClassName } from "./class-names";
import { headingClassName } from "./layout-classes";

function BackLink({ href, label }) {
  return (
    <Link
      href={href}
      className="inline-flex min-h-11 items-center rounded-lg text-sm font-semibold text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
    >
      <span aria-hidden="true">←&nbsp;</span>
      <span className="sr-only">Back to </span>
      {label}
    </Link>
  );
}

export function PageHeading({
  title,
  description = "",
  back = null,
  action = null,
  size = "lg",
  tracking = "tighter",
  className = "",
  titleClassName = "",
}) {
  const heading = (
    <h1 className={headingClassName({ size, tracking, className: titleClassName })}>
      {title}
    </h1>
  );

  return (
    <header className={composeClassName("min-w-0", className)}>
      {back ? <BackLink href={back.href} label={back.label} /> : null}
      <div
        className={composeClassName(
          "flex items-center justify-between gap-4",
          back ? "mt-2" : "",
        )}
      >
        {heading}
        {action ?? null}
      </div>
      {description ? (
        <p className="mt-2 text-sm text-ink-muted">{description}</p>
      ) : null}
    </header>
  );
}
