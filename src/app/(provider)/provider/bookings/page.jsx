"use client";
import Link from "next/link";
import { useState, useEffect } from "react";
import { getAllBookings } from "./actions";

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
    href={`/provider/bookings/${booking.booking_id}`}
  >
    <div className="appearance-none list-none rounded-xl border p-2.5 duration-200 hover:border-black/20 hover:bg-black/5 ">
      <div className="flex h-full">
        <div className="max-w-sm flex-1 overflow-hidden text-ellipsis">
          <h2 className="font-semibold">{booking.customer_name}</h2>
          <p className="mt-3 text-sm">{booking.treatment_name}</p>

          <span className="flex flex-wrap gap-1 text-sm">
            <p className="font-semibold">{booking.date_label},</p>
            <p className="font-semibold">{booking.time_label}</p>
            <p>{`(${booking.duration_label})`}</p>
          </span>
          <p className="mt-2 text-sm font-medium">{booking.total_price_label}</p>
          <p className="text-xs capitalize text-black/60">{booking.status}</p>
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
