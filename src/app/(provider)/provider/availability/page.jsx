import { AvailabilityForm } from "./availability-form";
import {
  blockDate,
  getBlockedDates,
  getSchedule,
  removeBlockedDate,
  updateSchedule,
} from "./actions";

export default async function SchedulePage() {
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
