// A short message about the state of something the person is looking at:
// "Your page isn't taking new bookings", "That time was just taken".
//
// `attention` is the amber notice Payments already used for a restriction;
// `neutral` is a quiet grey box for information that needs no action. The
// title is optional. Use role="status" (the default) for a message that
// appears after something happened and role="alert" only for a failure the
// person must deal with now; pass role={null} for a message that is simply
// part of the page.
import { composeClassName } from "./class-names";

const TONES = {
  attention: "rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900",
  neutral: "rounded-xl bg-surface-subtle p-4 text-sm text-ink/80",
};

export function noticeClassName(tone = "attention", className = "") {
  return composeClassName(TONES[tone] ?? TONES.attention, className);
}

export function Notice({ tone = "attention", title = "", role = "status", className = "", children }) {
  return (
    <div role={role ?? undefined} className={noticeClassName(tone, className)}>
      {title ? <p className="font-semibold">{title}</p> : null}
      {children ? <div className={title ? "mt-1" : ""}>{children}</div> : null}
    </div>
  );
}
