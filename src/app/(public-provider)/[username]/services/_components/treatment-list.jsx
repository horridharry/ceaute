import Link from "next/link";
import {
  formatDurationMinutes,
  formatPricePence,
} from "../../_lib/public-provider-format";
import { SmallTreatmentPhoto } from "./treatment-photo";

const NoTreatments = () => (
  <div className="flex h-52 rounded-xl border p-2 duration-200">
    <span className="m-auto flex flex-col">
      <p className="w-max text-center text-sm">
        This provider has not added treatments yet.
      </p>
    </span>
  </div>
);

const TreatmentItem = ({ treatment, username }) => (
  <Link href={`/@${username}/services/${treatment.id}`}>
    <div className="rounded-xl border p-2.5 duration-200 hover:border-black/20 hover:bg-black/5">
      <div className="flex h-full items-center gap-2.5">
        <SmallTreatmentPhoto url={treatment.image_url} />

        <div className="max-w-sm flex-1 overflow-hidden text-ellipsis">
          <h2 className="font-medium">{treatment.name}</h2>
          <p className="truncate text-sm text-black/60">
            {treatment.description}
          </p>
          <span className="mt-3 flex gap-1 text-sm font-medium">
            <p>{formatPricePence(treatment.price_pence)}</p>
            <p>•</p>
            <p>{formatDurationMinutes(treatment.duration_minutes)}</p>
          </span>
        </div>
      </div>
    </div>
  </Link>
);

export function TreatmentList({ treatments, providerPage }) {
  return (
    <main className="container max-w-md p-5">
      <div className="mt-6 flex flex-col">
        <h1 className="text-3xl font-bold tracking-tighter">
          Choose a service
        </h1>
        <p className="mt-1 text-sm">{`Booking with @${providerPage.username}`}</p>
        <div className="mt-12 flex flex-col gap-4">
          {treatments.map((treatment) => (
            <li key={treatment.id} className="list-none">
              <TreatmentItem
                treatment={treatment}
                username={providerPage.username}
              />
            </li>
          ))}
          {treatments.length === 0 ? <NoTreatments /> : null}
        </div>
      </div>
    </main>
  );
}
