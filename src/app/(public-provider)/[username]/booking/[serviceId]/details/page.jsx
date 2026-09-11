import { redirect } from "next/navigation";
import { BookingTreatmentSummary } from "../../_components/booking-treatment-summary";
import {
  createBookingForSelectedTime,
  getSelectedBookingTime,
} from "../../actions";
import { getPublicTreatmentPage } from "../../../_lib/public-provider-data";
import { notFound } from "next/navigation";
import {
  addMinutes,
  formatDateLabel,
  formatTimeLabel,
  hasPublicUsernamePrefix,
  normalizePublicUsername,
} from "../../../_lib/public-provider-format";

export default async function UsernameDetailsPage({ params }) {
  const { username, serviceId } = await params;

  if (!hasPublicUsernamePrefix(username)) {
    notFound();
  }

  const decodedUsername = normalizePublicUsername(username);
  const { providerPage, treatment } = await getPublicTreatmentPage(
    decodedUsername,
    serviceId,
  );
  const selectedBookingTime = await getSelectedBookingTime();

  if (!selectedBookingTime) {
    redirect(`/@${providerPage.username}/booking/${treatment.id}`);
  }

  const startAt = new Date(selectedBookingTime);
  if (Number.isNaN(startAt.getTime())) {
    redirect(`/@${providerPage.username}/booking/${treatment.id}`);
  }

  const endAt = addMinutes(startAt, treatment.duration_minutes);

  const handleSubmit = async (formData) => {
    "use server";

    await createBookingForSelectedTime({
      username: providerPage.username,
      treatmentId: treatment.id,
      formData,
    });
  };

  return (
    <main className="container max-w-md p-5">
      <div className="mt-6 flex flex-col">
        <h1 className="text-3xl font-bold tracking-tighter">
          Review and confirm
        </h1>
        <p className="mt-1 text-sm">
          One last step before your booking is complete
        </p>

        <div className="mt-8">
          <h2 className="hidden text-lg font-semibold tracking-tighter">
            Treatment
          </h2>
          <div className="flex flex-col gap-1">
            <h3 className="text-lg font-semibold">
              {providerPage.display_name}
            </h3>
            <span className="flex items-center gap-1">
              <p className="text-sm font-semibold text-black">
                {formatDateLabel(startAt)}
              </p>
              <p>
                <span className="text-sm">
                  {formatTimeLabel(startAt)} - {formatTimeLabel(endAt)}
                </span>
              </p>
            </span>
          </div>
          <div className="mt-2">
            <BookingTreatmentSummary treatment={treatment} />
          </div>
        </div>

        <span className="mt-8 border border-b" />

        <form
          action={handleSubmit}
          id="book_appointment"
          className="mt-8 flex flex-col gap-4"
        >
          <span className="field-set">
            <label htmlFor="customer_fullname" className="label">
              Full Name
            </label>

            <input
              type="text"
              id="customer_fullname"
              name="customer_fullname"
              required
              className="field"
            />
          </span>
          <span className="field-set">
            <label htmlFor="customer_email" className="label">
              Email
            </label>

            <input
              type="email"
              id="customer_email"
              name="customer_email"
              required
              className="field"
            />
          </span>
          <span className="field-set">
            <label htmlFor="customer_mobile" className="label">
              Phone Number
            </label>

            <input
              type="text"
              id="customer_mobile"
              name="customer_mobile"
              required
              className="field"
            />
          </span>
          <div className="ml-auto mt-8 flex items-center gap-4">
            <SubmitButton />
          </div>
        </form>
      </div>
    </main>
  );
}

const SubmitButton = () => {
  return (
    <button
      form="book_appointment"
      type="submit"
      className="w-max rounded-lg bg-pink-700 p-3 px-4 text-sm font-semibold text-white shadow-sm duration-200 hover:bg-pink-800 disabled:cursor-not-allowed disabled:opacity-60 aria-disabled:cursor-not-allowed aria-disabled:opacity-50"
    >
      Book appointment
    </button>
  );
};
