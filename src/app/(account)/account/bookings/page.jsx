import { ListGroup, ListTemplate } from "@/components/templates/list-template";
import { BookingCard } from "@/components/ui/booking-card";
import { EmptyState } from "@/components/ui/empty-state";
import { Tabs } from "@/components/ui/tabs";
import { getCustomerBookings } from "./actions";

// T1 · List. Tabs switch the list in place and travel in the URL, so a tab is
// shareable and the back button behaves.
const TABS = [
  { value: "upcoming", label: "Upcoming", group: "upcoming" },
  { value: "past", label: "Past", group: "previous" },
  { value: "cancelled", label: "Cancelled", group: "cancelled" },
];

// The date column wants a weekday and a day number, and `date_label` is a
// whole sentence, so it is split rather than re-derived — booking-display.js
// stays the one place that formats a booking.
function splitDateLabel(dateLabel) {
  const [weekday, rest] = String(dateLabel ?? "").split(",");

  return {
    weekdayLabel: (weekday ?? "").trim().slice(0, 3),
    dayLabel: (rest ?? "").trim().split(" ")[0] ?? "",
  };
}

// booking-display.js returns "Unavailable" when a booking has no payment
// attempt yet — a hold that has not been paid for. Appending "due" to that
// produces "Unavailable due", so the amount is simply left off instead.
function amountLabel(booking) {
  const amount = booking.amount_due_at_appointment_label;

  if (!amount || amount === "Unavailable") return undefined;
  if (amount === "£0.00") return "Paid in full";

  return `${amount} due`;
}

function Bookings({ bookings }) {
  return bookings.map((booking) => {
    const { weekdayLabel, dayLabel } = splitDateLabel(booking.date_label);

    return (
      <BookingCard
        key={booking.booking_id}
        href={`/account/bookings/${booking.booking_id}`}
        weekdayLabel={weekdayLabel}
        dayLabel={dayLabel}
        title={booking.treatment_name}
        amountLabel={amountLabel(booking)}
        meta={`${booking.provider_name} · ${booking.time_label}`}
        status={booking.status}
        statusLabel={booking.status_label}
      />
    );
  });
}

export default async function CustomerBookingsPage({ searchParams }) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const requested = String(resolvedSearchParams.tab ?? "").trim();
  const activeTab = TABS.find((tab) => tab.value === requested) ?? TABS[0];

  const bookingGroups = await getCustomerBookings();
  const bookings = bookingGroups[activeTab.group] ?? [];
  const hasAnyBookings = TABS.some(
    (tab) => (bookingGroups[tab.group] ?? []).length > 0,
  );

  // The design also shows an "Awaiting your review" group. It is not built:
  // get_customer_booking_summaries does not say whether a booking has been
  // reviewed, and only the detail route loads that. Listing every completed
  // booking there would duplicate the Past tab and ask for reviews that have
  // already been written. A review-presence flag on the summaries would make
  // it a few lines.

  return (
    <ListTemplate
      title="Bookings"
      filters={
        hasAnyBookings ? (
          <Tabs
            label="Bookings"
            value={activeTab.value}
            items={TABS.map((tab) => ({
              value: tab.value,
              label: tab.label,
              href: `/account/bookings?tab=${tab.value}`,
            }))}
          />
        ) : null
      }
    >
      {!hasAnyBookings ? (
        <EmptyState
          title="No bookings yet"
          actionHref="/discover"
          actionLabel="Find someone"
        >
          When you book someone, it shows here with the address and what&rsquo;s
          due.
        </EmptyState>
      ) : bookings.length === 0 ? (
        <EmptyState title={`Nothing ${activeTab.label.toLowerCase()}`}>
          There is nothing in this list yet.
        </EmptyState>
      ) : (
        <ListGroup>
          <Bookings bookings={bookings} />
        </ListGroup>
      )}
    </ListTemplate>
  );
}
