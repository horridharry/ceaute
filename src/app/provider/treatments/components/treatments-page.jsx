"use client";
import Link from "next/link";
import { useState } from "react";

import { TreatmentPhoto } from "./treatment-photo";

const convertDuration = (duration) => {
  const treatmentDuration = duration.split(":");
  const hours = parseInt(treatmentDuration[1]);
  const minutes = parseInt(treatmentDuration[2]);

  return [hours ? `${hours} hours` : "", minutes ? `${minutes} minutes` : ""]
    .filter(Boolean)
    .join(" ");
};

const TreatmentsLoading = () => (
  <div className="duration-200 opacity-100 rounded-xl border p-4 grid gap-4">
    <span className="p-2 animate-pulse bg-black/20 rounded-md w-1/2"></span>
    <span className="p-4 animate-pulse bg-black/20 rounded-md w-3/4"></span>
  </div>
);

const NoTreatments = () => (
  <div className="duration-200 rounded-xl border p-2 h-52 flex">
    <span className="m-auto flex flex-col ">
      <p className="text-sm  text-center w-max">
        You haven&apos;t create any treatments yet
      </p>
      <Link
        href="/provider/treatments/create"
        className="mt-4  text-sm mx-auto font-semibold w-max text-center flex items-center overflow-hidden rounded-3xl bg-white p-1.5 px-3 text-pink-600 duration-300 hover:bg-pink-500/10"
      >
        {"Create a new treatment"}
      </Link>
    </span>
  </div>
);

const TreatmentItem = ({ treatment }) => (
  <Link href={`/provider/treatments/update/${treatment.treatment_id}`}>
    <div className="rounded-xl border p-2.5 duration-200 hover:border-black/20 hover:bg-black/5 ">
      <div className="flex h-full items-center gap-2.5">
        <TreatmentPhoto url={treatment?.image_url} />

        <div className="max-w-sm flex-1 overflow-hidden text-ellipsis">
          <h2 className="font-medium">{treatment?.name}</h2>
          <p className="truncate text-black/60 text-sm">
            {treatment?.description}
          </p>
          <span className="mt-3 flex gap-1 font-medium text-sm">
            <p className="">
              {Intl.NumberFormat("en-GB", {
                style: "currency",

                currency: "GBP",
              }).format(treatment?.price)}
            </p>
            •<p> {convertDuration(treatment?.duration)}</p>
          </span>
        </div>
      </div>
    </div>
  </Link>
);

export function TreatmentsUI({ clientTreatments }) {
  const [treatments] = useState(clientTreatments);
  const [treatmentsLoading] = useState(false);
  return (
    <main className="container max-w-md p-5">
      <div className="mt-6 flex flex-col">
        <div className="flex items-end justify-between">
          <h1 className="text-3xl font-bold tracking-tighter">Treatments</h1>
          <p hidden className="text-sm mt-1">
            Adjust your schedule to suit your routine
          </p>
          {treatments.length !== 0 && (
            <Link href="/provider/treatments/create">
              <div
                className={
                  "text-sm font-semibold w-max text-center items-center overflow-hidden rounded-3xl bg-white p-1.5 px-3 text-pink-600 duration-300 hover:bg-pink-500/10 flex"
                }
              >
                {"Create a new treatment"}
              </div>
            </Link>
          )}
        </div>
        <div className="flex flex-col gap-4 mt-12">
          {treatmentsLoading && <TreatmentsLoading />}
          {treatments &&
            treatments?.map((treatment) => {
              return (
                <li key={treatment.treatment_id} className="list-none">
                  <TreatmentItem treatment={treatment} />
                </li>
              );
            })}
          {!treatmentsLoading && treatments.length === 0 && <NoTreatments />}
        </div>
      </div>
    </main>
  );
}
