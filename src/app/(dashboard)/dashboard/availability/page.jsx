import { getSignedInProvider } from "../_lib/provider-data";
import { AvailabilityForm } from "./availability-form";
import { saveDrop } from "./actions";
import { todayInLondon } from "./_lib/today-london";
import { getBookingCountsByDate, getDrops } from "./queries";

export default async function DashboardAvailabilityPage() {
  const [drops, bookingCountRows, { providerPage }] = await Promise.all([
    getDrops(),
    getBookingCountsByDate(),
    getSignedInProvider({ next: "/dashboard/availability" }),
  ]);
  const isPublished = providerPage.status === "published";
  const today = todayInLondon();
  // Read once per request, so every drop's status and the editor's starting
  // drop time are decided against the same moment the page was rendered.
  // eslint-disable-next-line react-hooks/purity -- a Server Component renders once per request
  const now = Date.now();

  return (
    <AvailabilityForm
      drops={drops}
      bookingCountRows={bookingCountRows}
      isPublished={isPublished}
      today={today}
      now={now}
      saveDrop={saveDrop}
    />
  );
}
