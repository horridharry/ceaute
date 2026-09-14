import Link from "next/link";
import {
  formatDurationMinutes,
  formatPricePence,
} from "../../_lib/public-provider-format";
import { BigTreatmentPhoto } from "./treatment-photo";

const TreatmentItem = ({ treatment }) => (
  <div className="rounded-xl border p-2.5 duration-200">
    <BigTreatmentPhoto url={treatment.image_url} />
    <div className="mt-4 max-w-sm flex-1">
      <h2 className="text-2xl font-semibold tracking-tighter">
        {treatment.name}
      </h2>
      <p className="mt-2 text-sm text-black/60">{treatment.description}</p>
      <span className="mt-6 flex gap-1 font-semibold tracking-tight">
        <p>{formatPricePence(treatment.price_pence)}</p>
        <p>•</p>
        <p>{formatDurationMinutes(treatment.duration_minutes)}</p>
      </span>
    </div>
  </div>
);

export function TreatmentDetail({ treatment, providerPage }) {
  return (
    <main className="container max-w-md p-5">
      <div className="mt-6 flex flex-col">
        <h1 className="text-3xl font-bold tracking-tighter">
          Choose a service
        </h1>
        <p className="mt-1 text-sm">{`Booking with @${providerPage.username}`}</p>
        <div className="mt-8 flex flex-col gap-4">
          <TreatmentItem treatment={treatment} />
          <div className="flex items-center justify-end gap-2.5">
            <Link
              href={`/@${providerPage.username}/services`}
              className="w-max rounded-lg border border-black/10 p-3 px-6 text-sm font-semibold text-pink-600 duration-200 hover:border-black/20 active:border-transparent active:bg-pink-500/10 active:text-pink-500 disabled:cursor-not-allowed disabled:opacity-60 aria-disabled:cursor-not-allowed aria-disabled:opacity-50"
            >
              Back
            </Link>
            <Link
              href={`/@${providerPage.username}/book/${treatment.id}`}
              className="w-max rounded-lg bg-pink-700 p-3 px-4 text-sm font-semibold text-white shadow-sm duration-200 hover:bg-pink-800 disabled:cursor-not-allowed disabled:opacity-60 aria-disabled:cursor-not-allowed aria-disabled:opacity-60"
            >
              {`Book "${treatment.name}" now`}
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
