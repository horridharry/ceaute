import Link from "next/link";
import { unstable_rethrow } from "next/navigation";
import { buttonClassName } from "@/components/ui/button-classes";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { BookingRow } from "../_components/booking-row";
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
    return { groups: null, readiness: null, failed: true };
  }
}

function CheckIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" className="h-3 w-3">
      <path d="m5 12 5 5 9-10" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// While the page is a draft: every publication requirement, each opening the
// section where it is met. It is a checklist, not a wizard, and publishing
// stays a deliberate step in Settings → Publication.
function ReadinessCard({ readiness }) {
  const left = readiness.missing.length;

  return (
    <Card as="section" aria-labelledby="get-ready" className="mt-6">
      <h2 id="get-ready" className="text-[15px] font-semibold">
        Get ready to publish
      </h2>
      <p className="mt-1 text-[13px] text-ink-muted">
        {left
          ? `${left} ${left === 1 ? "thing" : "things"} left. Each opens the section where you set it up.`
          : "Everything’s in place. Publish your page when you’re ready."}
      </p>
      <ul className="mt-2">
        {readiness.requirements.map((requirement) => (
          <li key={requirement.label} className="border-b border-line last:border-b-0">
            <Link
              href={requirement.href}
              className="flex min-h-11 items-center gap-3 rounded-lg text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
            >
              <span
                aria-hidden="true"
                className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border-[1.5px] ${
                  requirement.met ? "border-ink bg-ink text-white" : "border-line-strong"
                }`}
              >
                {requirement.met ? <CheckIcon /> : null}
              </span>
              <span className={requirement.met ? "text-ink-muted" : ""}>
                {requirement.label}
                <span className="sr-only">{requirement.met ? ", done" : ", to do"}</span>
              </span>
              {requirement.met ? null : (
                <span aria-hidden="true" className="ml-auto text-[13px] font-semibold text-accent">
                  Set up
                </span>
              )}
            </Link>
          </li>
        ))}
      </ul>
      <Link
        href="/dashboard/settings/publication"
        className={buttonClassName({ variant: "secondary", className: "mt-3" })}
      >
        Go to Publication
      </Link>
    </Card>
  );
}

export default async function DashboardTodayPage() {
  const now = new Date();
  const { groups, readiness, failed } = await loadOverview();
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
      {readiness ? <ReadinessCard readiness={readiness} /> : null}

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
              <ul className="mt-2">
                {today.map((booking) => (
                  <BookingRow key={booking.booking_id} booking={booking} variant="today" />
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
              <ul className="mt-2">
                {upcoming.map((booking) => (
                  <BookingRow key={booking.booking_id} booking={booking} variant="upcoming" />
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
