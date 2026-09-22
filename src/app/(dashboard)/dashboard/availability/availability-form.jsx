import { BlockedDatesForm } from "./_components/blocked-dates-form";
import { WeeklyScheduleForm } from "./_components/weekly-schedule-form";

export function AvailabilityForm({
  schedule,
  blockedDates,
  bookingCountRows,
  isPublished,
  today,
  updateSchedule,
  blockDate,
  removeBlockedDate,
}) {
  return (
    <main className="container mx-auto max-w-md p-5">
      <div className="mt-6 flex flex-col">
        <h1 className="text-3xl font-bold tracking-tighter">Availability</h1>
        {schedule.length === 0 ? (
          // Driven by the saved week (no working days saved), not the draft.
          <p className="mt-4 rounded-lg bg-black/[0.04] p-3 text-sm">
            Customers can&apos;t book you until you&apos;re open on at least one
            day.
          </p>
        ) : null}

        <WeeklyScheduleForm
          schedule={schedule}
          isPublished={isPublished}
          updateSchedule={updateSchedule}
        />

        <BlockedDatesForm
          blockedDates={blockedDates}
          bookingCountRows={bookingCountRows}
          today={today}
          schedule={schedule}
          blockDate={blockDate}
          removeBlockedDate={removeBlockedDate}
        />
      </div>
    </main>
  );
}
