// The frame of every dashboard screen: a centred container (the page's
// <main>) and one heading with an optional description, "New" action, back
// link or other action. Availability and Booking settings set the rhythm:
// the heading starts 24px into the container and content follows below it.
import { PageContainer } from "@/components/ui/page-container";
import { SectionHeading } from "./section-heading";

export function DashboardPage({
  title,
  description = "",
  newHref = "",
  newLabel = "New",
  back = null,
  action = null,
  size = "lg",
  width = "narrow",
  children,
}) {
  return (
    <PageContainer width={width}>
      <SectionHeading
        title={title}
        description={description}
        newHref={newHref}
        newLabel={newLabel}
        back={back}
        action={action}
        size={size}
      />
      {children}
    </PageContainer>
  );
}
