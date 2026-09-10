"use client";
import { useState } from "react";

const BookingProvider = ({ children }) => {
  const [bookingData, setBookingData] = useState();
  return <div>{children}</div>;
};

export { BookingProvider };
