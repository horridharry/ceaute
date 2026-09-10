import { storeInCookies, createBooking } from "../../actions";
import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";
import { DateTime } from "luxon";
import { redirect } from "next/navigation";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { formatDuration } from "date-fns";
import { TreatmentItem } from "./TreatmentItem";

dayjs.extend(duration);

const convertDuration = (duration) => {
  const treatmentDuration = duration.split(":");
  return formatDuration({
    hours: parseInt(treatmentDuration[1]),
    minutes: parseInt(treatmentDuration[2]),
  });
};
export default async function UsernameDetailsPage({
  params: { username, serviceId },
}) {
  const decodedUsername = decodeURIComponent(username).slice(1);
  const supabase = createClient();

  const { data: profile, error } = await supabase
    .from("businessprofiles")
    .select("*, treatments!inner(*), schedules(*)")
    .eq("username", decodedUsername)
    .eq("treatments.treatment_id", serviceId)
    .single();

  if (error) {
    console.error(error);
  }

  const cookieStore = cookies();

  const booking_time = cookieStore.get("booking_time");

  const bookingDetails = {
    treatment_id: serviceId,
    duration: profile.treatments[0].duration,
    booking_time: DateTime.fromMillis(Number(booking_time.value)).toISO(),
  };

  const handleSubmit = async (formData) => {
    "use server";

    const bookingDetails = {
      profile_id: profile.profile_id,
      treatment_id: serviceId,
      duration: profile.treatments[0].duration,
      booking_time: DateTime.fromMillis(Number(booking_time.value)).toISO(),
      customer_fullname: formData.get("customer_fullname"),
      customer_email: formData.get("customer_email"),
      customer_mobile: formData.get("customer_mobile"),
      customer_social: formData.get("customer_socialmedia"),
    };

    await createBooking(bookingDetails);

    /*
    redirect(
      `/@${decodedUsername}/appointments?bookingId=${booking.booking_id}`
    );
    /*
    const customerDetails = {
      customer_name: formData.get("customer_name"),
      customer_email: formData.get("customer_email"),
      customer_mobile: formData.get("customer_mobile"),
    };

    storeInCookies("customer_name", customerDetails.customer_name);
    storeInCookies("customer_email", customerDetails.customer_email);
    storeInCookies("customer_mobile", customerDetails.customer_mobile);

    return router.push(
      `/@${decodedUsername}/booking/${serviceId}/details/checkout`
    );
    */
  };
  return (
    <main className="container max-w-md p-5">
      <div className="mt-6 flex flex-col">
        <h1 className="text-3xl font-bold tracking-tighter">
          Review and confirm
        </h1>
        <p className="text-sm mt-1">{`One last step before your booking is complete`}</p>

        <div className="mt-8">
          <h2 className="hidden text-lg font-semibold tracking-tighter">
            Treatment
          </h2>
          <div className="flex flex-col gap-1">
            <h3 className="font-semibold text-lg">{profile?.business_name}</h3>
            <span className="flex items-center gap-1">
              <p className="text-sm font-semibold text-black">
                {`${dayjs(bookingDetails.booking_time).format("dddd, DD MMM")}`}
              </p>
              <p>
                <span className="text-sm ">
                  {dayjs(bookingDetails.booking_time).format("h:mm")} -{" "}
                  {dayjs(bookingDetails.booking_time)
                    .add(
                      dayjs.duration({
                        hours: profile.treatments[0].duration.split(":")[1],
                        minutes: profile.treatments[0].duration.split(":")[2],
                      })
                    )
                    .format("h:mm A")}
                </span>
              </p>
            </span>
          </div>
          <div className="mt-2">
            <TreatmentItem treatment={profile?.treatments[0]} />
          </div>
        </div>

        <span className="border-b border-1 border mt-8" />

        <form
          action={handleSubmit}
          id="book_appointment"
          className="flex flex-col gap-4 mt-8"
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
          <span className="field-set">
            <label htmlFor="customer_socialmedia" className="label">
              Social Media
            </label>

            <input
              type="text"
              id="customer_socialmedia"
              name="customer_socialmedia"
              required
              className="field"
            />
          </span>
          <div className="mt-8 flex gap-4 items-center ml-auto">
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
      className="w-max rounded-lg font-semibold bg-pink-700 bg- p-3 px-4 text-sm  text-white shadow-sm duration-200 hover:bg-pink-800 disabled:cursor-not-allowed disabled:opacity-60 aria-disabled:cursor-not-allowed aria-disabled:opacity-50"
    >
      Book appointment{" "}
    </button>
  );
};
