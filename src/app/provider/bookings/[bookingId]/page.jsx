"use client";
import Link from "next/link";
import { useState, useEffect } from "react";
import { getAllBookings } from "../actions";

export default function TreatmentsPage() {
  const [treatments, setTreatments] = useState([]);
  const [treatmentsLoading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAllTreatments = async () => {
      const allTreatments = await getAllBookings();
      setTreatments(allTreatments);
      setLoading(false);
    };

    fetchAllTreatments().catch(console.error);
  }, []);

  const convertDuration = (duration) => {
    const treatmentDuration = duration.split(":");
    const hours = parseInt(treatmentDuration[1]);
    const minutes = parseInt(treatmentDuration[2]);

    return [hours ? `${hours} hours` : "", minutes ? `${minutes} minutes` : ""]
      .filter(Boolean)
      .join(" ");
  };

  return (
    <main className="container mx-auto max-w-md p-5">
      <div className="mt-12 flex flex-col">
        <div className="flex items-end justify-between">
          <h1 className="text-2xl font-bold tracking-tight text-black/80">
            Your bookings
          </h1>
        </div>
        <div className="mt-6 grid gap-4">
          {treatmentsLoading && (
            <div className="duration-200 opacity-100 rounded-xl border p-4 grid gap-4">
              <span className="p-2 animate-pulse bg-black/20 rounded-md w-1/2"></span>
              <span className="p-4 animate-pulse bg-black/20 rounded-md w-3/4"></span>
            </div>
          )}
          {treatments &&
            treatments?.map((treatment) => {
              return (
                <Link
                  key={treatment.booking_id}
                  href={`/provider/bookings/${treatment.booking_id}`}
                >
                  <div className="grid gap-2.5 rounded-xl border p-2.5 py-2.5 duration-200 hover:border-black/10 hover:bg-black/5 focus:bg-black/5">
                    <div className="flex items-center">
                      <div className="max-w-sm flex-1 overflow-hidden text-ellipsis text-sm">
                        <h2 className="text-base font-medium">
                          {treatment?.name}
                        </h2>
                        <span className="mt-3 text-black/70">
                          {convertDuration(treatment?.duration)}
                        </span>
                        <p className="truncate text-black/70">
                          {treatment?.description}
                        </p>

                        <p className="mt-4 font-medium">
                          {Intl.NumberFormat("en-GB", {
                            style: "currency",

                            currency: "GBP",
                          }).format(treatment?.price)}
                        </p>
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
        </div>
      </div>
    </main>
  );
}
