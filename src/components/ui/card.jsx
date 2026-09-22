// A bounded group of related content. Use a card when the border adds
// grouping or a tap target, not to separate every item on a page.
import Link from "next/link";
import { cardClassName, cardLinkClassName } from "./layout-classes";

export function Card({
  as: Element = "div",
  padding = "md",
  border = "line",
  interactive = false,
  className = "",
  children,
  ...rest
}) {
  return (
    <Element
      className={cardClassName({ padding, border, interactive, className })}
      {...rest}
    >
      {children}
    </Element>
  );
}

// A card that is one link. The link carries focus; the card inside shows the
// hover state. Put no other links or buttons inside it.
export function CardLink({
  href,
  as = "article",
  padding = "md",
  border = "line",
  className = "",
  linkClassName = "",
  children,
  ...linkProps
}) {
  return (
    <Link
      href={href}
      className={cardLinkClassName({ padding, className: linkClassName })}
      {...linkProps}
    >
      <Card as={as} padding={padding} border={border} interactive className={className}>
        {children}
      </Card>
    </Link>
  );
}
