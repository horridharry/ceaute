import Link from "next/link";
import { StatusDot } from "@/components/ui/status";
import { CatalogueTabs } from "../../_components/catalogue-tabs";
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
  <StatusDot
    tone={isActive ? "ok" : "muted"}
    label={isActive ? "Active" : "Archived"}
  />
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

export function TreatmentsUI({ treatments, counts }) {
  return (
    <main className="mx-auto w-full max-w-[720px] px-5 py-6">
      <div className="flex flex-col gap-4">
        <div className="flex items-end justify-between gap-3">
          <h1 className="text-display text-pretty text-ink">Treatments</h1>
          <Link
            href="/dashboard/treatments/new"
            className="shrink-0 text-[13px] font-medium text-plum transition duration-150 ease-out hover:text-plum-hover"
          >
            + New
          </Link>
        </div>

        <CatalogueTabs value="treatments" counts={counts} />

        <div className="mt-2 flex flex-col gap-4">
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
