import { CardLink } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageContainer } from "@/components/ui/page-container";
import { PageHeading } from "@/components/ui/page-heading";
import { getCustomerBookings } from "./queries";

// These cards and empty states have always drawn their border in the text
// colour (a bare `border` under Tailwind 4); border="current" keeps that.
const NoBookings = () => (
  <EmptyState as="div" variant="bounded" border="current">
    You do not have any bookings yet.
  </EmptyState>
);

const BookingItem = ({ booking }) => (
  <CardLink
    href={`/account/bookings/${booking.booking_id}`}
    padding="sm"
    border="current"
  >
    <h3 className="font-semibold">{booking.provider_name}</h3>
    <p className="mt-3 text-sm">{booking.treatment_name}</p>
    {booking.selected_add_ons.length ? (
      <p className="mt-1 text-sm text-ink-muted">
        Add-ons:{" "}
        {booking.selected_add_ons.map((addOn) => addOn.name).join(", ")}
      </p>
    ) : null}
    <p className="mt-3 text-sm font-semibold">
      {booking.date_label}, {booking.time_label}
    </p>
    <p className="mt-2 text-sm">Total: {booking.total_price_label}</p>
    <p className="text-sm text-ink-muted">
      Paid online: {booking.amount_paid_online_label}
    </p>
    <p className="text-sm text-ink-muted">
      Due at appointment: {booking.amount_due_at_appointment_label}
    </p>
    <p className="mt-2 text-xs text-ink-muted">{booking.status_label}</p>
  </CardLink>
);

const BookingSection = ({ title, bookings }) => (
  <section className="mt-8">
    <h2 className="text-lg font-semibold">{title}</h2>
    <ul className="mt-3 flex flex-col gap-4">
      {bookings.map((booking) => (
        <li key={booking.booking_id}>
          <BookingItem booking={booking} />
        </li>
      ))}
      {bookings.length === 0 ? (
        <EmptyState as="li" variant="bounded" border="current">
          No bookings.
        </EmptyState>
      ) : null}
    </ul>
  </section>
);

export default async function CustomerBookingsPage() {
  const bookingGroups = await getCustomerBookings();
  const hasBookings =
    bookingGroups.upcoming.length > 0 ||
    bookingGroups.previous.length > 0 ||
    bookingGroups.cancelled.length > 0;

  return (
    <PageContainer>
      <div className="mt-6 flex flex-col">
        <PageHeading title="Bookings" />

        <div className="mt-8">
          {!hasBookings ? <NoBookings /> : null}
          {hasBookings ? (
            <>
              <BookingSection title="Upcoming" bookings={bookingGroups.upcoming} />
              <BookingSection title="Previous" bookings={bookingGroups.previous} />
              <BookingSection
                title="Cancelled"
                bookings={bookingGroups.cancelled}
              />
            </>
          ) : null}
        </div>
      </div>
    </PageContainer>
  );
}
