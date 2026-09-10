"use client";
import Link from "next/link";
import Image from "next/image";
import { useState, useEffect } from "react";
import { formatDuration } from "date-fns";
import { createClient } from "@/utils/supabase/client";

import { BigTreatmentPhoto } from "./treatmentPhoto";

const convertDuration = (duration) => {
  const treatmentDuration = duration.split(":");
  return formatDuration({
    hours: parseInt(treatmentDuration[1]),
    minutes: parseInt(treatmentDuration[2]),
  });
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
        You haven't create any treatments yet
      </p>
      <Link
        href="/dashboard/treatments/create"
        className="mt-4  text-sm mx-auto font-semibold w-max text-center flex items-center overflow-hidden rounded-3xl bg-white p-1.5 px-3 text-pink-600 duration-300 hover:bg-pink-500/10"
      >
        {"Create a new treatment"}
      </Link>
    </span>
  </div>
);

const TreatmentItem = ({ treatment, decodedUsername }) => (
  <div className="rounded-xl border p-2.5 duration-200 ">
    <BigTreatmentPhoto url={treatment?.image_url} />
    <div className="max-w-sm flex-1 mt-4">
      <h2 className="font-semibold text-2xl tracking-tighter">
        {treatment?.name}
      </h2>
      <p className=" text-black/60 mt-2 text-sm">{treatment?.description}</p>
      <span className="mt-6 flex gap-1 font-semibold tracking-tight">
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
);

export function SingleTreatmentUI({ singleTreatment, decodedUsername }) {
  const [treatment, setTreatment] = useState(singleTreatment);
  const [treatmentLoading, setLoading] = useState(false);
  return (
    <main className="container max-w-md p-5">
      <div className="mt-6 flex flex-col">
        <h1 className="text-3xl font-bold tracking-tighter">
          Choose a service
        </h1>
        <p className="text-sm mt-1">{`Booking with @${decodedUsername}`}</p>
        <div className="flex flex-col gap-4 mt-8">
          <TreatmentItem
            treatment={treatment}
            decodedUsername={decodedUsername}
          />
          <div className="flex gap-2.5 items-center justify-end">
            <Link
              href={`/@${decodedUsername}/services`}
              className="w-max rounded-lg font-semibold hover:border-black/20 border-black/10 text-pink-600 p-3 px-6 text-sm border duration-200 active:bg-pink-500/10  active:border-transparent active:text-pink-500 disabled:cursor-not-allowed disabled:opacity-60 aria-disabled:cursor-not-allowed aria-disabled:opacity-50"
            >
              Back
            </Link>
            <Link
              href={`/@${decodedUsername}/booking/${treatment.treatment_id}`}
              className="w-max rounded-lg font-semibold bg-pink-700 bg- p-3 px-4 text-sm  text-white shadow-sm duration-200 hover:bg-pink-800 disabled:cursor-not-allowed disabled:opacity-60 aria-disabled:cursor-not-allowed aria-disabled:opacity-60"
            >
              {`Book "${treatment.name}" now`}
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
