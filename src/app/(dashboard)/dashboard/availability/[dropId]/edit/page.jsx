import { notFound } from "next/navigation";
import { getSignedInProvider } from "../../../_lib/provider-data";
import { DashboardPage } from "../../../_components/dashboard-page";
import { DropEditor } from "../../_components/drop-editor";
import { saveDrop } from "../../actions";
import { toBookingCountsByDate } from "../../_lib/booking-messages";
import { dropStatusLine } from "../../_lib/drop-form";
import { todayInLondon } from "../../_lib/today-london";
import { getBookingCountsByDate, getDrops } from "../../queries";

// One drop on its own page, so browser Back returns to the list. The drop
// comes from the provider's own current drops (read through row-level
// security), so another provider's drop, an unknown id and a drop whose dates
// have all passed are all not found.
export default async function EditDropPage({ params }) {
  const { dropId } = await params;
  // Signed-in check first, so a signed-out provider comes back here.
  const [, drops, bookingCountRows] = await Promise.all([
    getSignedInProvider({ next: `/dashboard/availability/${dropId}/edit` }),
    getDrops(),
    getBookingCountsByDate(),
  ]);
  const drop = drops.find((candidate) => candidate.id === dropId);

  if (!drop) {
    notFound();
  }

  // Read once per request, so the drop's status and the editor's starting
  // drop time are decided against the same moment the page was rendered.
  // eslint-disable-next-line react-hooks/purity -- a Server Component renders once per request
  const now = Date.now();

  return (
    <DashboardPage
      title={drop.name}
      description={dropStatusLine(drop, now)}
      back={{ href: "/dashboard/availability", label: "Availability" }}
    >
      <div className="mt-6">
        <DropEditor
          key={drop.id}
          drop={drop}
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
