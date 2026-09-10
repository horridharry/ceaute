"use client";
import { useState } from "react";
import { DateTime } from "luxon";
import Link from "next/link";
import { storeInCookies } from "../actions";
import { useRouter } from "next/navigation";

const DEFAULT_SCHEDULE = [
  {
    dayOfWeek: "sunday",
    openTime: "09:00:00",
    closeTime: "18:00:00",
  },
  {
    dayOfWeek: "monday",
    openTime: "09:00:00",
    closeTime: "18:00:00",
  },
  {
    dayOfWeek: "tuesday",
    openTime: "09:00:00",
    closeTime: "18:00:00",
  },
  {
    dayOfWeek: "wednesday",
    openTime: "09:00:00",
    closeTime: "18:00:00",
  },
  {
    dayOfWeek: "thursday",
    openTime: "09:00:00",
    closeTime: "18:00:00",
  },
  {
    dayOfWeek: "friday",
    openTime: "09:00:00",
    closeTime: "18:00:00",
  },
  {
    dayOfWeek: "saturday",
    openTime: "09:00:00",
    closeTime: "18:00:00",
  },
];

export default function Scheduler({ schedule, treatment_id, username }) {
  const userSchedule = schedule;
  const router = useRouter();

  const currentDate = DateTime.now().plus({ days: 1 }).startOf("day");
  const [calendarDate, setCalendarDate] = useState(currentDate);
  const calendarDays = 2; // Number of days to display

  const calendarDates = Array.from({ length: calendarDays + 1 }, (_, i) => ({
    date: calendarDate.plus({ days: i }),
    slots: [],
  }));

  calendarDates.forEach((calendarDate) => {
    const dayOfWeek = calendarDate.date.weekdayLong.toLowerCase();
    const scheduleForDay = userSchedule.find((s) => s.dayOfWeek === dayOfWeek);

    if (scheduleForDay) {
      // Parse openTime and closeTime safely
      const openTime = DateTime.fromFormat(scheduleForDay.openTime, "HH:mm");
      const closeTime = DateTime.fromFormat(scheduleForDay.closeTime, "HH:mm");
      console.log(openTime, closeTime);

      // Check if parsing was successful
      if (openTime.isValid && closeTime.isValid) {
        console.log("success");
        let currentSlot = calendarDate.date.set({
          hour: openTime.hour,
          minute: openTime.minute,
        });
        const endTime = calendarDate.date.set({
          hour: closeTime.hour,
          minute: closeTime.minute,
        });

        while (currentSlot < endTime) {
          if (currentSlot > currentDate.plus({ hour: 1 })) {
            calendarDate.slots.push(currentSlot);
          }
          currentSlot = currentSlot.plus({ minutes: 30 });
        }
      } else {
        console.error("Invalid time format in schedule:", scheduleForDay);
      }
    }
  });

  const handleSubmit = (slot) => {
    storeInCookies("booking_time", slot.ts);
    return router.push(`/@${username}/booking/${treatment_id}/details`);
  };
  return (
    <>
      <div className="p-4 flex items-center justify-between">
        <p className="font-semibold text-2xl tracking-tighter">
          {`${calendarDates[0].date.monthLong}`}
        </p>
        <p className="hidden font-medium">
          {`${calendarDates[0].date.day} ${calendarDates[0].date.monthLong} - ${calendarDates[calendarDays].date.day} ${calendarDates[calendarDays].date.monthShort}, ${calendarDates[calendarDays].date.year}`}
        </p>
        <div className="flex items-center gap-1">
          <button
            className="p-1.5 duration-200 hover:bg-pink-100 text-sm font-medium rounded-full px-3 text-pink-700 active:underline"
            onClick={() =>
              setCalendarDate(calendarDate.minus({ days: calendarDays }))
            }
          >
            Back
          </button>

          <button
            className="p-1.5 duration-200 hover:bg-pink-100 text-sm font-medium rounded-full px-3 text-pink-700 active:underline"
            onClick={() =>
              setCalendarDate(calendarDate.plus({ days: calendarDays }))
            }
          >
            Next
          </button>
        </div>
      </div>
      <ul className="border-t pt-4 mt-3 flex justify-around">
        {calendarDates.map((calendarDate) => (
          <li
            key={calendarDate.date.toISODate()}
            className="flex flex-1 flex-col items-center px-1.5"
          >
            <p className="text-sm">{calendarDate.date.weekdayShort}</p>
            <p className="text-xl font-semibold">{calendarDate.date.day}</p>
            <div className="mt-3 flex w-full flex-col gap-2">
              {calendarDate.slots.map((slot) => {
                console.log(slot);
                return (
                  /*
                <Link
                  key={slot.toISO()}
                  className="w-full rounded-lg border border-gray-200 p-2 text-sm font-medium duration-200 hover:bg-gray-100"
                  href={`#`} // Replace with actual link
                >
                  {slot.toLocaleString(DateTime.TIME_SIMPLE)}
                </Link>
                */
                  <button
                    key={slot.toISO()}
                    onClick={() => handleSubmit(slot)}
                    className="w-full rounded-lg border border-gray-200 p-4 text-sm font-medium duration-200 hover:bg-gray-100 hover:border-black/30"
                  >
                    {slot
                      .toFormat("h:mm a")
                      .toLocaleString(DateTime.TIME_SIMPLE)
                      .toLowerCase()}
                  </button>
                );
              })}
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
