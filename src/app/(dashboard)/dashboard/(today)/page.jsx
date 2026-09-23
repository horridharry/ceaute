import Link from "next/link";
import { unstable_rethrow } from "next/navigation";
import { buttonClassName } from "@/components/ui/button-classes";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Notice } from "@/components/ui/notice";
import { legalIdentity } from "@/lib/legal/identity";
import { BookingCard } from "../_components/booking-card";
import { DashboardPage } from "../_components/dashboard-page";
import { getTodayOverview } from "./queries";

const londonDay = new Intl.DateTimeFormat("en-GB", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  timeZone: "Europe/London",
});

const londonDateLabel = new Intl.DateTimeFormat("en-GB", {
  weekday: "long",
  day: "numeric",
  month: "long",
  timeZone: "Europe/London",
});

const isToday = (value, now) => {
  const date = new Date(value);
  return !Number.isNaN(date.getTime()) && londonDay.format(date) === londonDay.format(now);
};

const UPCOMING_LIMIT = 3;

async function loadOverview() {
  try {
    return { ...(await getTodayOverview()), failed: false };
  } catch (error) {
    unstable_rethrow(error);
    console.error(error);
    return { groups: null, setup: null, failed: true };
  }
}

// A draft whose setup is complete. Readiness is not publication: nothing goes
// live until the provider publishes on Settings → Publication.
function ReadyToPublishCard() {
  return (
    <Card as="section" aria-labelledby="ready-to-publish" className="mt-6 flex flex-col gap-2">
      <h2 id="ready-to-publish" className="flex items-center gap-2 text-[15px] font-semibold">
        <span aria-hidden="true" className="h-2 w-2 rounded-full bg-ink-subtle" />
        Ready to publish
      </h2>
      <p className="text-sm text-ink-muted">
        Everything customers need is in place. Your page isn’t live until you publish it.
      </p>
      <Link
        href="/dashboard/settings/publication"
        className={buttonClassName({ variant: "primary", size: "compact", className: "w-max" })}
      >
        Go to Publication
      </Link>
    </Card>
  );
}

// A live page that cannot take new bookings. It stays published and its
// confirmed bookings stand; the provider is told exactly what to do.
function PausedNotice({ reasons }) {
  return (
    <Notice title="Your page isn’t taking new bookings" className="mt-6">
      <p>It’s still live, and confirmed bookings aren’t affected. To take new bookings:</p>
      <ul className="mt-1">
        {reasons.map((reason) => (
          <li key={reason.id}>
            {reason.href ? (
              <Link href={reason.href} className="inline-flex min-h-11 items-center font-semibold underline underline-offset-2">
                {reason.label}
              </Link>
            ) : (
              <span className="inline-flex min-h-11 items-center font-semibold">{reason.label}</span>
            )}
          </li>
        ))}
      </ul>
    </Notice>
  );
}

function SetupNotices({ setup }) {
  if (!setup) {
    return null;
  }

  if (setup.suspended) {
    return (
      <Notice title="Your page is suspended" className="mt-6">
        Customers can’t see or book it. Contact Ceaute at{" "}
        <span className="font-semibold">{legalIdentity.contactEmail}</span> for help.
      </Notice>
    );
  }

  if (setup.readyToPublish) {
    return <ReadyToPublishCard />;
  }

  if (setup.published && !setup.acceptsNewBookings) {
    return <PausedNotice reasons={setup.pausedReasons} />;
  }

  return null;
}

export default async function DashboardTodayPage() {
  const now = new Date();
  const { groups, setup, failed } = await loadOverview();
  const today = failed
    ? []
    : [...groups.upcoming, ...groups.completed]
        .filter((booking) => isToday(booking.start_at, now))
        .sort((first, second) => String(first.start_at).localeCompare(String(second.start_at)));
  const upcoming = failed
    ? []
    : groups.upcoming.filter((booking) => !isToday(booking.start_at, now)).slice(0, UPCOMING_LIMIT);

  return (
    <DashboardPage title="Today" description={londonDateLabel.format(now)}>
      <SetupNotices setup={setup} />

      {failed ? (
        <p role="alert" className="mt-8 text-sm text-danger">
          Could not load today&apos;s bookings. Refresh to try again.
        </p>
      ) : (
        <>
          <section aria-labelledby="today-bookings" className="mt-8">
            <h2 id="today-bookings" className="text-xl font-semibold tracking-tight">
              Today
            </h2>
            {today.length ? (
              <ul className="mt-3 flex flex-col gap-2">
                {today.map((booking) => (
                  <BookingCard key={booking.booking_id} booking={booking} variant="today" />
                ))}
              </ul>
            ) : (
              <EmptyState className="mt-2">No bookings today.</EmptyState>
            )}
          </section>

          <section aria-labelledby="upcoming-bookings" className="mt-10">
            <h2 id="upcoming-bookings" className="text-xl font-semibold tracking-tight">
              Upcoming
            </h2>
            {upcoming.length ? (
              <ul className="mt-3 flex flex-col gap-2">
                {upcoming.map((booking) => (
                  <BookingCard key={booking.booking_id} booking={booking} variant="upcoming" />
                ))}
              </ul>
            ) : (
              <EmptyState className="mt-2">No upcoming bookings.</EmptyState>
            )}
            <Link href="/dashboard/bookings" className={buttonClassName({ variant: "outline", className: "mt-4 w-full" })}>
              See all bookings
            </Link>
          </section>
        </>
      )}
    </DashboardPage>
  );
}
