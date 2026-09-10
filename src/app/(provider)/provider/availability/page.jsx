"use client";
import Link from "next/link";
import { useState, useCallback, useEffect } from "react";
import { updateSchedule, getSchedule } from "./actions";

const generateTimeOptions = (intervalMinutes = 15) => {
  const timeOptions = [];

  for (let totalMinutes = 0; totalMinutes < 24 * 60; totalMinutes += intervalMinutes) {
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    const value = `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
    const label = new Date(2000, 0, 1, hours, minutes).toLocaleTimeString(
      "en-GB",
      { hour: "numeric", minute: "2-digit", hour12: true },
    );

    timeOptions.push({
      value,
      label,
    });
  }

  return timeOptions;
};

const DAYS_OF_WEEK = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
];

export default function SchedulePage() {
  const [stateMessage, setStateMessage] = useState("");
  const [openHours, setOpenHours] = useState([]);

  useEffect(() => {
    const fetchSchedule = async () => {
      const schedule = await getSchedule();
      const formattedSchedule = schedule.map((entry) => {
        return {
          dayOfWeek: entry.day_of_week,
          openTime: String(entry.start_time).slice(0, 5),
          closeTime: String(entry.end_time).slice(0, 5),
        };
      });
      setOpenHours(formattedSchedule);
    };
    fetchSchedule().catch(console.error);
  }, []);

  const [errors, setErrors] = useState({});
  const [isSaving, setIsSaving] = useState(false);

  const timeOptions = generateTimeOptions();

  const toggleDayAvailability = useCallback((dayOfWeek) => {
    setOpenHours((prevHours) => {
      const dayIndex = prevHours.findIndex(
        (hour) => hour.dayOfWeek === dayOfWeek
      );
      if (dayIndex !== -1) {
        return prevHours.filter((hour) => hour.dayOfWeek !== dayOfWeek);
      } else {
        return [
          ...prevHours,
          {
            dayOfWeek,
            openTime: "08:00",
            closeTime: "18:00",
          },
        ];
      }
    });
    setErrors({}); // Clear errors when toggling availability
  }, []);

  const handleTimeChange = useCallback(
    (dayOfWeek, timeType) => (event) => {
      const newTime = event.target.value;
      setOpenHours((prevHours) => {
        const updatedHours = prevHours.map((hour) => {
          if (hour.dayOfWeek === dayOfWeek) {
            return {
              ...hour,
              [timeType]: newTime,
            };
          }
          return hour;
        });

        // Perform validation
        const dayIndex = updatedHours.findIndex(
          (hour) => hour.dayOfWeek === dayOfWeek
        );
        if (dayIndex !== -1) {
          const openTime = updatedHours[dayIndex].openTime;
          const closeTime = updatedHours[dayIndex].closeTime;
          if (closeTime <= openTime) {
            setErrors((prevErrors) => ({
              ...prevErrors,
              [dayOfWeek]: "Closing time must be after opening time.",
            }));
          } else {
            setErrors((prevErrors) =>
              Object.fromEntries(
                Object.entries(prevErrors).filter(([key]) => key !== dayOfWeek)
              )
            );
          }
        }

        return updatedHours;
      });
    },
    []
  );

  const handleSubmit = async () => {
    setIsSaving(true);
    const response = await updateSchedule(openHours);
    if (response) {
      setStateMessage(response);
      setIsSaving(false);
    }

    /*
    try {

      if (response.ok) {
        console.log("Schedule saved successfully!");
      } else {
        const errorData = await response.json();
        setApiError(errorData.message || "Error saving schedule.");
      }
    } catch (error) {
      console.error("Error saving schedule:", error);
      setApiError("An unexpected error occurred.");
    } finally {
      console.log(isSaving);
      setIsSaving(false);
    }
      */
  };

  return (
    <main className="p-5">
      <h1 className="text-3xl font-bold tracking-tighter mt-6">Availability</h1>
      <p className="text-sm mt-1">Adjust your schedule to suit your routine</p>
      <form id="availability" action={handleSubmit}>
        <div className="mt-12 grid gap-4">
          {DAYS_OF_WEEK.map((dayOfWeek) => {
            const checked = openHours.some(
              (hour) => hour.dayOfWeek === dayOfWeek
            );
            return (
              <div
                key={dayOfWeek}
                className={dayOfWeek === "sunday" ? "" : "border-b"}
              >
                <div className="flex items-center pb-4">
                  <label
                    htmlFor={dayOfWeek}
                    className={
                      !checked
                        ? "flex-1 capitalize text-sm "
                        : "flex-1 capitalize font-medium text-sm"
                    }
                  >
                    {dayOfWeek}
                  </label>
                  <input
                    type="checkbox"
                    id={dayOfWeek}
                    name={dayOfWeek}
                    checked={openHours.some(
                      (hour) => hour.dayOfWeek === dayOfWeek
                    )}
                    onChange={() => toggleDayAvailability(dayOfWeek)}
                    className="h-5 w-5 checked:bg-pink-600 checked:border-transparent bg-white duration-200 appearance-none outline-none ring-1 ring-transparent cursor-pointer border border-black/30 hover:border-pink-600 hover:ring-pink-600 rounded"
                  />
                </div>
                {openHours.some((hour) => hour.dayOfWeek === dayOfWeek) && (
                  <div className="pb-5">
                    <div className="flex gap-x-2.5 pb-3">
                      {["openTime", "closeTime"].map((timeType) => {
                        // Display empty string if no time is selected
                        return (
                          <div key={timeType} className="grid flex-1 text-sm">
                            <label
                              htmlFor={`${dayOfWeek}-${timeType}`}
                              className="capitalize text-sm font-medium"
                            >
                              {" "}
                              {timeType.replace("Time", "")}
                            </label>
                            <select
                              id={`${dayOfWeek}-${timeType}`}
                              name={`${dayOfWeek}-${timeType}`}
                              className="cursor-pointer appearance-none bg-white mt-1 rounded-md border border-black/20 p-3 outline-none ring-1 ring-transparent hover:border-pink-500 focus:border-pink-600 focus:ring-pink-600 duration-200"
                              value={
                                openHours.find(
                                  (hour) => hour.dayOfWeek === dayOfWeek
                                )?.[timeType]
                              }
                              onChange={handleTimeChange(dayOfWeek, timeType)}
                            >
                              {timeOptions.map((timeOption) => (
                                <option
                                  key={timeOption.value}
                                  value={timeOption.value}
                                >
                                  {timeOption.label}
                                </option>
                              ))}
                            </select>
                          </div>
                        );
                      })}
                    </div>
                    {/* Display error message if it exists for the day */}
                    {errors[dayOfWeek] && (
                      <p className="text-sm text-red-500">
                        {errors[dayOfWeek]}
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
          {/* Display API errors */}
        </div>
        {stateMessage && <p className="text-sm text-red-500">{stateMessage}</p>}
        <div className="mt-8 flex gap-4 items-center justify-end">
          <Link
            href="/provider"
            className="w-max rounded-lg font-semibold hover:border-black/20 border-black/10 text-pink-600 p-3 px-6 text-sm border duration-200 active:bg-pink-500/10  active:border-transparent active:text-pink-500 disabled:cursor-not-allowed disabled:opacity-60 aria-disabled:cursor-not-allowed aria-disabled:opacity-50"
          >
            Back
          </Link>
          <SubmitButton pending={isSaving} />
        </div>
      </form>
    </main>
  );
}

const SubmitButton = ({ pending }) => {
  return (
    <button
      form="availability"
      type="submit"
      className="w-max rounded-lg font-semibold bg-pink-700 bg- p-3 px-4 text-sm  text-white shadow-sm duration-200 hover:bg-pink-800 disabled:cursor-not-allowed disabled:opacity-60 aria-disabled:cursor-not-allowed aria-disabled:opacity-50"
      aria-disabled={pending}
      disabled={pending}
    >
      {!pending ? "Update schedule" : "Updating..."}
    </button>
  );
};
