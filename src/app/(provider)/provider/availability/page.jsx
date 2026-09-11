import { AvailabilityForm } from "./availability-form";
import { getSchedule, updateSchedule } from "./actions";

export default async function SchedulePage() {
  const schedule = await getSchedule();

  return <AvailabilityForm schedule={schedule} updateSchedule={updateSchedule} />;
}
