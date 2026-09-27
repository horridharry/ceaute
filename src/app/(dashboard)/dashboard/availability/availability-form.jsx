// The Availability screen: the provider's drops, each with an Edit link to
// its own page, and Add dates for a new one. Adding or editing a drop happens
// on /dashboard/availability/new and /dashboard/availability/[dropId]/edit,
// so browser Back from the editor returns here.
import Link from "next/link";
import { buttonClassName } from "@/components/ui/button-classes";
import { EmptyState } from "@/components/ui/empty-state";
import { Notice } from "@/components/ui/notice";
import { DashboardPage } from "../_components/dashboard-page";
import { DropList } from "./_components/drop-list";
import { toBookingCountsByDate } from "./_lib/booking-messages";

export function AvailabilityForm({ drops, bookingCountRows, isPublished, now }) {
  const countsByDate = toBookingCountsByDate(bookingCountRows);

  const addDatesLink = (
    <Link
      href="/dashboard/availability/new"
      className={buttonClassName({ variant: "secondary", className: "self-start" })}
    >
      Add dates
    </Link>
  );

  return (
    <DashboardPage
      title="Availability"
      description="Pick dates, give them times and choose when they open for booking."
    >
      <div className="mt-6 flex flex-col gap-6">
        {isPublished && drops.length === 0 ? (
          <Notice tone="neutral" role={null}>
            Customers can&apos;t book: you have no open dates.
          </Notice>
        ) : null}

        {drops.length === 0 ? (
          <EmptyState action={addDatesLink}>No dates yet.</EmptyState>
        ) : (
          <>
            <DropList drops={drops} countsByDate={countsByDate} now={now} />
            {addDatesLink}
          </>
        )}
      </div>
    </DashboardPage>
  );
}
