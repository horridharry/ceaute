// A native <button> in one of Ceaute's button styles. The styles live in
// ./button-classes.js so a link can look identical through
// buttonClassName(); see docs/design-system.md for when to use each variant.
import { buttonClassName } from "./button-classes";

export function Button({
  variant = "primary",
  size = "md",
  surface = "light",
  className = "",
  ...rest
}) {
  if (
    size === "icon" &&
    !rest["aria-label"] &&
    !rest["aria-labelledby"] &&
    process.env.NODE_ENV !== "production"
  ) {
    console.error("An icon-sized Button needs an aria-label or aria-labelledby.");
  }

  return (
    <button
      className={buttonClassName({ variant, size, surface, className })}
      {...rest}
    />
  );
}
