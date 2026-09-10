import BookingScheduler from "../_components/booking-scheduler";
import { getPublicBookingPage } from "../../_lib/public-provider-data";
import { notFound } from "next/navigation";
import {
  hasPublicUsernamePrefix,
  normalizePublicUsername,
} from "../../_lib/public-provider-format";

export default async function UsernameBookingPage({ params }) {
  const { username, serviceId } = await params;

  if (!hasPublicUsernamePrefix(username)) {
    notFound();
  }

  const decodedUsername = normalizePublicUsername(username);
  const { providerPage, treatment, availabilityRules } =
    await getPublicBookingPage(decodedUsername, serviceId);

  return (
    <main className="container max-w-md p-5">
      <div className="mt-6 flex flex-col">
        <h1 className="text-3xl font-bold tracking-tighter">Choose a time</h1>
        <p className="mt-1 text-sm">{`Booking with @${providerPage.username}`}</p>
        <div className="mt-12 flex flex-col gap-4 rounded-lg border">
          <BookingScheduler
            username={providerPage.username}
            treatment={treatment}
            availabilityRules={availabilityRules}
          />
        </div>
      </div>
    </main>
  );
}
