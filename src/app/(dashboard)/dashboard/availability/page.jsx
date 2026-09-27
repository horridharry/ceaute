import { getSignedInProvider } from "../_lib/provider-data";
import { AvailabilityForm } from "./availability-form";
import { getBookingCountsByDate, getDrops } from "./queries";

export default async function DashboardAvailabilityPage() {
  const [drops, bookingCountRows, { providerPage }] = await Promise.all([
    getDrops(),
    getBookingCountsByDate(),
    getSignedInProvider({ next: "/dashboard/availability" }),
  ]);
  const isPublished = providerPage.status === "published";
  // Read once per request, so every drop's status is decided against the
  // same moment the page was rendered.
  // eslint-disable-next-line react-hooks/purity -- a Server Component renders once per request
  const now = Date.now();

  return (
    <AvailabilityForm
      drops={drops}
      bookingCountRows={bookingCountRows}
      isPublished={isPublished}
      now={now}
    />
  );
}
