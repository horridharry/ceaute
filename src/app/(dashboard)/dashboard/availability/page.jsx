import { AvailabilityForm } from "./availability-form";
import { blockDate, removeBlockedDate, updateSchedule } from "./actions";
import { getBlockedDates, getSchedule } from "./queries";

export default async function DashboardAvailabilityPage() {
  const [schedule, blockedDates] = await Promise.all([
    getSchedule(),
    getBlockedDates(),
  ]);

  return (
    <AvailabilityForm
      schedule={schedule}
      blockedDates={blockedDates}
      updateSchedule={updateSchedule}
      blockDate={blockDate}
      removeBlockedDate={removeBlockedDate}
    />
  );
}
