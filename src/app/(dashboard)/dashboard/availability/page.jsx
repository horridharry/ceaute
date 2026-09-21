import { getSignedInProvider } from "../_lib/provider-data";
import { AvailabilityForm } from "./availability-form";
import { blockDate, removeBlockedDate, updateSchedule } from "./actions";
import { todayInLondon } from "./_lib/today-london";
import {
  getBlockedDates,
  getBookingCountsByDate,
  getSchedule,
} from "./queries";

export default async function DashboardAvailabilityPage() {
  const [schedule, blockedDates, bookingCountRows, { providerPage }] =
    await Promise.all([
      getSchedule(),
      getBlockedDates(),
      getBookingCountsByDate(),
      getSignedInProvider({ next: "/dashboard/availability" }),
    ]);
  const isPublished = providerPage.status === "published";
  const today = todayInLondon();

  return (
    <AvailabilityForm
      schedule={schedule}
      blockedDates={blockedDates}
      bookingCountRows={bookingCountRows}
      isPublished={isPublished}
      today={today}
      updateSchedule={updateSchedule}
      blockDate={blockDate}
      removeBlockedDate={removeBlockedDate}
    />
  );
}
