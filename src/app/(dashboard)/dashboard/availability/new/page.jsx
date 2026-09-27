import { getSignedInProvider } from "../../_lib/provider-data";
import { DashboardPage } from "../../_components/dashboard-page";
import { DropEditor } from "../_components/drop-editor";
import { saveDrop } from "../actions";
import { toBookingCountsByDate } from "../_lib/booking-messages";
import { todayInLondon } from "../_lib/today-london";
import { getBookingCountsByDate, getDrops } from "../queries";

// A new drop on its own page, so browser Back returns to the list.
export default async function NewDropPage() {
  // Signed-in check first, so a signed-out provider comes back here.
  const [, drops, bookingCountRows] = await Promise.all([
    getSignedInProvider({ next: "/dashboard/availability/new" }),
    getDrops(),
    getBookingCountsByDate(),
  ]);
  // Read once per request, so the editor's starting drop time is decided
  // against the moment the page was rendered.
  // eslint-disable-next-line react-hooks/purity -- a Server Component renders once per request
  const now = Date.now();

  return (
    <DashboardPage
      title="Add dates"
      back={{ href: "/dashboard/availability", label: "Availability" }}
    >
      <div className="mt-6">
        <DropEditor
          drop={null}
          drops={drops}
          countsByDate={toBookingCountsByDate(bookingCountRows)}
          today={todayInLondon()}
          now={now}
          saveDrop={saveDrop}
        />
      </div>
    </DashboardPage>
  );
}
