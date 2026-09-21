import { PageSectionNav } from "../_components/page-section-nav";
import { BlockedDatesForm } from "./_components/blocked-dates-form";
import { WeeklyScheduleForm } from "./_components/weekly-schedule-form";

export function AvailabilityForm({
  schedule,
  blockedDates,
  updateSchedule,
  blockDate,
  removeBlockedDate,
}) {
  return (
    <main className="container max-w-md p-5">
      <div className="mt-6 flex flex-col">
        <PageSectionNav />
        <h2 className="mt-8 text-2xl font-semibold tracking-tighter">
          Availability
        </h2>
        <p className="mt-1 text-sm text-black/60">
          Set your regular hours in Europe/London time.
        </p>

        <WeeklyScheduleForm schedule={schedule} updateSchedule={updateSchedule} />

        <BlockedDatesForm
          blockedDates={blockedDates}
          blockDate={blockDate}
          removeBlockedDate={removeBlockedDate}
        />
      </div>
    </main>
  );
}
