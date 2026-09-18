import { unstable_rethrow } from "next/navigation";
import { ListGroup, ListTemplate } from "@/components/templates/list-template";
import { BookingCard } from "@/components/ui/booking-card";
import { EmptyState } from "@/components/ui/empty-state";
import { ProblemNotice } from "@/components/ui/notice";
import { Tabs } from "@/components/ui/tabs";
import { getAllBookings } from "./actions";

const TABS = [
  { value: "upcoming", label: "Upcoming", group: "upcoming" },
  { value: "past", label: "Past", group: "previous" },
  { value: "cancelled", label: "Cancelled", group: "cancelled" },
];

function splitDateLabel(dateLabel) {
  const [weekday, rest] = String(dateLabel ?? "").split(",");

  return {
    weekdayLabel: (weekday ?? "").trim().slice(0, 3),
    dayLabel: (rest ?? "").trim().split(" ")[0] ?? "",
  };
}

// Loads bookings during the server render, like the customer bookings page.
// The previous client component rendered an empty shell and then called the
// same loader through a second server round trip, so every visit paid for two
// requests through the proxy and function before any booking appeared. The
// route-level loading.jsx already gives navigation its pending state.
async function loadBookingGroups() {
  try {
    return { bookingGroups: await getAllBookings(), failed: false };
  } catch (error) {
    // Sign-in redirects are thrown; they must reach Next.js untouched.
    unstable_rethrow(error);
    console.error(error);
    return { bookingGroups: null, failed: true };
  }
}

export default async function DashboardBookingsPage({ searchParams }) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const requested = String(resolvedSearchParams.tab ?? "").trim();
  const activeTab = TABS.find((tab) => tab.value === requested) ?? TABS[0];

  const { bookingGroups, failed } = await loadBookingGroups();
  const bookings = failed ? [] : (bookingGroups[activeTab.group] ?? []);
  const hasBookings =
    !failed && TABS.some((tab) => (bookingGroups[tab.group] ?? []).length > 0);

  return (
    <ListTemplate
      title="Bookings"
      filters={
        hasBookings ? (
          <Tabs
            label="Bookings"
            value={activeTab.value}
            items={TABS.map((tab) => ({
              value: tab.value,
              label: tab.label,
              href: `/dashboard/bookings?tab=${tab.value}`,
            }))}
          />
        ) : null
      }
    >
      {failed ? (
        <ProblemNotice title="Could not load your bookings">
          Refresh to try again.
        </ProblemNotice>
      ) : !hasBookings ? (
        <EmptyState title="No bookings yet">
          When someone books you, the appointment shows here with their number
          and what to collect.
        </EmptyState>
      ) : bookings.length === 0 ? (
        <EmptyState title={`Nothing ${activeTab.label.toLowerCase()}`}>
          There is nothing in this list yet.
        </EmptyState>
      ) : (
        <ListGroup>
          {bookings.map((booking) => {
            const { weekdayLabel, dayLabel } = splitDateLabel(booking.date_label);

            return (
              <BookingCard
                key={booking.booking_id}
                href={`/dashboard/bookings/${booking.booking_id}`}
                weekdayLabel={weekdayLabel}
                dayLabel={dayLabel}
                title={`${booking.customer_name} · ${booking.treatment_name}`}
                amountLabel={
                  booking.amount_due_at_appointment_label === "£0.00"
                    ? "Paid in full"
                    : `${booking.amount_due_at_appointment_label} to collect`
                }
                meta={`${booking.time_label} · ${booking.duration_label}`}
                status={booking.status}
                statusLabel={booking.status_label}
              />
            );
          })}
        </ListGroup>
      )}
    </ListTemplate>
  );
}
