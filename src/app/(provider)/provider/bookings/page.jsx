"use client";
import Link from "next/link";
import { useState, useEffect } from "react";
import { getAllBookings } from "./actions";

const convertDuration = (duration) => {
  const treatmentDuration = duration.split(":");
  const hours = parseInt(treatmentDuration[1]);
  const minutes = parseInt(treatmentDuration[2]);

  return [hours ? `${hours} hours` : "", minutes ? `${minutes} minutes` : ""]
    .filter(Boolean)
    .join(" ");
};

const addDuration = (dateTime, duration) => {
  const treatmentDuration = duration.split(":");
  const hours = parseInt(treatmentDuration[1]);
  const minutes = parseInt(treatmentDuration[2]);
  const date = new Date(dateTime);

  date.setMinutes(date.getMinutes() + hours * 60 + minutes);

  return date;
};

const formatDate = (dateTime, options) => {
  return new Intl.DateTimeFormat("en-GB", options).format(new Date(dateTime));
};

const BookingsLoading = () => (
  <div className="duration-200 rounded-xl border p-2 h-52 flex animate-pulse">
    <p className="text-sm font-medium opacity-50 text-center m-auto">
      Loading bookings...
    </p>
  </div>
);

const NoBookings = () => (
  <div className="duration-200 rounded-xl border p-2 h-52 flex">
    <p className="text-sm  text-center m-auto">
      You don&apos;t have any bookings yet
    </p>
  </div>
);

const BookingItem = ({ booking }) => (
  <Link
    key={booking.treatment_id}
    href={`/provider/bookings/${booking.booking_id}`}
  >
    <div className="appearance-none list-none rounded-xl border p-2.5 duration-200 hover:border-black/20 hover:bg-black/5 ">
      <div className="flex h-full">
        <div className="max-w-sm flex-1 overflow-hidden text-ellipsis">
          <h2 className="font-semibold">{booking?.customer_fullname}</h2>
          <p className=" text-sm mt-3">{booking?.treatments?.name}</p>

          <span className="flex gap-1 text-sm">
            <p className="font-semibold">
              {" "}
              {`${formatDate(booking.booking_time, {
                weekday: "long",
                day: "2-digit",
                month: "short",
              })},`}
            </p>
            <p className="font-semibold">
              {" "}
              {` ${formatDate(booking.booking_time, {
                hour: "numeric",
                minute: "2-digit",
                hour12: true,
              })} - 
                ${formatDate(addDuration(booking.booking_time, booking.treatments.duration), {
                  hour: "numeric",
                  minute: "2-digit",
                  hour12: true,
                })}`}
            </p>{" "}
            <p className=""> {`(${convertDuration(booking?.duration)})`}</p>
          </span>
        </div>
      </div>
    </div>
  </Link>
);

export default function BookingsPage() {
  const [bookings, setBookings] = useState([]);
  const [bookingsLoading, setBookingsLoading] = useState(true);

  useEffect(() => {
    const fetchAllBookings = async () => {
      const allBookings = await getAllBookings();
      setBookings(allBookings);
      setBookingsLoading(false);
    };

    fetchAllBookings().catch(console.error);
  }, []);

  return (
    <main className="container max-w-md p-5">
      <div className="mt-6 flex flex-col">
        <h1 className="text-3xl font-bold tracking-tighter">Bookings</h1>
        <p className="text-sm mt-1">Manage your bookings with clients</p>
        <ul className="flex flex-col gap-4 mt-12">
          {bookingsLoading && <BookingsLoading />}
          {bookings &&
            bookings?.map((booking) => {
              return (
                <li className="list-none" key={booking.booking_id}>
                  <BookingItem booking={booking} />
                </li>
              );
            })}
          {!bookingsLoading && bookings.length === 0 && <NoBookings />}
        </ul>
      </div>
    </main>
  );
}
