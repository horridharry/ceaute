// Low-level <button>, styled with the variant treatments that repeat
// verbatim (or near-verbatim) across the dashboard, storefront, and auth
// screens. The exact class values below are quoted from the codebase, not
// invented -- see the task-2 evidence report for the full tally.
//
// A fourth "text" variant (a button styled as plain coloured text) was
// considered and dropped: the codebase only has two examples of it --
// FocusedTaskHeader's submit button and the OTP resend link in
// verify-code-form.jsx -- and they disagree on colour shade
// (text-pink-700 vs text-pink-600), on whether there is a hover transition,
// and on how the disabled state is shown (opacity-50 vs text-black/40).
// Two disagreeing examples are not a pattern to standardise on.
import { composeClassName } from "./class-names";

const VARIANT_CLASSES = {
  // Quoted from (among others) src/app/(dashboard)/dashboard/availability/availability-form.jsx:248,
  // src/app/(dashboard)/dashboard/profile/_components/provider-page-form.jsx:181, and
  // src/app/(dashboard)/dashboard/profile/portfolio/_components/portfolio-page-ui.jsx:86,
  // the exact string 6 of the 11 pink-700 primary buttons share.
  primary:
    "rounded-lg bg-pink-700 p-3 px-4 text-sm font-semibold text-white shadow-sm duration-200 hover:bg-pink-800 disabled:cursor-not-allowed disabled:opacity-60 aria-disabled:cursor-not-allowed aria-disabled:opacity-50",
  // Quoted from src/app/(dashboard)/dashboard/profile/_components/publication-actions.jsx:41 and
  // src/app/(dashboard)/dashboard/profile/portfolio/_components/portfolio-page-ui.jsx:127 (both p-3 px-4).
  secondary:
    "rounded-lg border border-black/10 p-3 px-4 text-sm font-semibold text-pink-600 duration-200 hover:border-black/20 disabled:cursor-not-allowed disabled:opacity-60 aria-disabled:cursor-not-allowed aria-disabled:opacity-60",
  // Quoted verbatim (less its w-max) from
  // src/app/(dashboard)/dashboard/treatment-groups/_components/treatment-groups-page.jsx:22.
  // Of the 5 rose-600 destructive buttons, 2 use px-4 and 2 use px-6; the fifth
  // (locations-page.jsx:53) is px-4 but drops hover:border-transparent. px-4 is
  // the shade used here and also matches the p-3 px-4 padding of the two
  // variants above.
  destructive:
    "rounded-lg p-3 px-4 text-sm font-semibold text-rose-600 duration-200 hover:border-transparent hover:bg-rose-50/80 active:bg-rose-600 active:text-white disabled:cursor-not-allowed disabled:opacity-60 aria-disabled:cursor-not-allowed aria-disabled:opacity-60",
};

export function Button({ variant = "primary", className, ...rest }) {
  const base = VARIANT_CLASSES[variant] ?? VARIANT_CLASSES.primary;

  return <button className={composeClassName(base, className)} {...rest} />;
}
