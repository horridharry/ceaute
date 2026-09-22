// The outer frame of a page: width, padding and desktop centring. It renders
// the page's <main> by default; pass `as="div"` when a layout above already
// provides the main landmark, so there is never a <main> inside a <main>.
import { containerClassName } from "./layout-classes";

export function PageContainer({
  as: Element = "main",
  width = "narrow",
  align = "center",
  className = "",
  children,
  ...rest
}) {
  return (
    <Element className={containerClassName({ width, align, className })} {...rest}>
      {children}
    </Element>
  );
}
