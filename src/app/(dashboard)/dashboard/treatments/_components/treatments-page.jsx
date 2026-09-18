import Link from "next/link";
import { formatDurationMinutes } from "../../_lib/provider-data";

const NoTreatments = () => (
  <div className="flex h-52 rounded-xl border p-2 duration-200">
    <span className="m-auto flex flex-col">
      <p className="w-max text-center text-sm">
        You haven&apos;t created any treatments yet
      </p>
      <Link
        href="/dashboard/treatments/new"
        className="mx-auto mt-4 flex w-max items-center overflow-hidden rounded-3xl bg-white p-1.5 px-3 text-center text-sm font-semibold text-plum duration-300 hover:bg-surface"
      >
        Create a new treatment
      </Link>
    </span>
  </div>
);

const TreatmentStatus = ({ isActive }) => (
  <span
    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
      isActive ? "bg-ok/10 text-ok" : "bg-black/5 text-black/50"
    }`}
  >
    {isActive ? "Active" : "Archived"}
  </span>
);

const TreatmentItem = ({ treatment }) => (
  <Link href={`/dashboard/treatments/${treatment.treatmentId}/edit`}>
    <article className="rounded-xl border p-3 duration-200 hover:border-black/20 hover:bg-black/5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h2 className="truncate font-medium">{treatment.name}</h2>
          <p className="mt-1 truncate text-sm text-black/60">
            {treatment.description}
          </p>
          <div className="mt-3 flex flex-wrap gap-x-1 gap-y-1 text-sm font-medium">
            <span>
              {Intl.NumberFormat("en-GB", {
                style: "currency",
                currency: "GBP",
              }).format(treatment.price)}
            </span>
            <span>•</span>
            <span>{formatDurationMinutes(treatment.duration_minutes)}</span>
          </div>
          <div className="mt-2 flex flex-wrap gap-x-1 gap-y-1 text-xs text-black/50">
            <span>{treatment.discovery_category_name}</span>
            {treatment.treatment_group_name ? (
              <>
                <span>•</span>
                <span>{treatment.treatment_group_name}</span>
              </>
            ) : null}
          </div>
        </div>
        <TreatmentStatus isActive={treatment.is_active} />
      </div>
    </article>
  </Link>
);

export function TreatmentsUI({ treatments }) {
  return (
    <main className="container max-w-md p-5">
      <div className="mt-6 flex flex-col">
        <div className="flex items-end justify-between">
          <h1 className="text-3xl font-bold tracking-tighter">Treatments</h1>
          <div className="flex items-center gap-2">
            <Link
              href="/dashboard/treatment-groups"
              className="flex w-max items-center overflow-hidden rounded-3xl bg-white p-1.5 px-3 text-center text-sm font-semibold text-plum duration-300 hover:bg-surface"
            >
              Manage groups
            </Link>
            <Link
              href="/dashboard/add-ons"
              className="flex w-max items-center overflow-hidden rounded-3xl bg-white p-1.5 px-3 text-center text-sm font-semibold text-plum duration-300 hover:bg-surface"
            >
              Manage add-ons
            </Link>
            {treatments.length !== 0 ? (
              <Link
                href="/dashboard/treatments/new"
                className="flex w-max items-center overflow-hidden rounded-3xl bg-white p-1.5 px-3 text-center text-sm font-semibold text-plum duration-300 hover:bg-surface"
              >
                Create
              </Link>
            ) : null}
          </div>
        </div>

        <div className="mt-12 flex flex-col gap-4">
          {treatments.map((treatment) => (
            <li key={treatment.treatmentId} className="list-none">
              <TreatmentItem treatment={treatment} />
            </li>
          ))}
          {treatments.length === 0 ? <NoTreatments /> : null}
        </div>
      </div>
    </main>
  );
}
