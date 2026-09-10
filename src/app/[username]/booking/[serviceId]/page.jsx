"use client";
import { useState, useEffect } from "react";
import { getAvailabilityByUsername, getTreatmentById } from "../actions";
import Schedular from "./Schedular";
import { DateTime } from "luxon";

export default function UsernameBookingPage({
  params: { username, serviceId },
}) {
  const [availability, setAvailability] = useState([]);
  const [treatment, setTreatment] = useState({});
  const decodedUsername = decodeURIComponent(username).slice(1);

  useEffect(() => {
    const fetchScheduleByUsername = async () => {
      const schedule = await getAvailabilityByUsername(decodedUsername);
      const formattedSchedule = schedule.map((entry) => {
        return {
          dayOfWeek: entry.day_of_week,
          openTime: DateTime.fromISO(entry.start_time).toFormat("HH:mm"), // Extract HH:mm from datetime
          closeTime: DateTime.fromISO(entry.end_time).toFormat("HH:mm"), // Extract HH:mm from datetime
        };
      });
      setAvailability(formattedSchedule);
    };

    const fetchTreatmentById = async () => {
      const treatment = await getTreatmentById(serviceId);
      setTreatment(treatment);
    };

    fetchScheduleByUsername().catch(console.error);
    fetchTreatmentById().catch(console.error);
  }, []);

  const slots = [{}];

  return (
    <main className="container max-w-md p-5">
      <div className="mt-6 flex flex-col">
        <h1 className="text-3xl font-bold tracking-tighter">
          Choose a service
        </h1>
        <p className="text-sm mt-1">{`Booking with @${decodedUsername}`}</p>
        <div className="flex flex-col gap-4 mt-12 border rounded-lg">
          <Schedular
            username={decodedUsername}
            slots={slots}
            treatment_id={treatment.treatment_id}
            schedule={availability}
          />
        </div>
      </div>
    </main>
  );
}
