import Link from "next/link";
import { formatDurationMinutes } from "../../_lib/provider-data";
import { CatalogueSectionNav } from "../../_components/catalogue-section-nav";

const NoTreatments = () => (
  <div className="flex h-40 rounded-xl border border-black/10 p-4">
    <span className="m-auto text-center text-sm text-black/55">
      No treatments yet.
    </span>
  </div>
);

const TreatmentStatus = ({ isActive }) => (
  <span
    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
      isActive ? "bg-pink-50 text-pink-700" : "bg-black/5 text-black/50"
    }`}
  >
    {isActive ? "Active" : "Archived"}
  </span>
);

const TreatmentItem = ({ treatment }) => (
  <Link href={`/dashboard/treatments/${treatment.treatmentId}/edit`}>
    <article className="min-w-0 rounded-xl border border-black/10 p-3 duration-200 hover:border-black/20 hover:bg-black/5">
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
    <main className="container w-full max-w-md min-w-0 p-5">
      <div className="mt-6 min-w-0">
        <CatalogueSectionNav />

        <ul className="mt-8 flex min-w-0 flex-col gap-4">
          {treatments.map((treatment) => (
            <li key={treatment.treatmentId} className="list-none">
              <TreatmentItem treatment={treatment} />
            </li>
          ))}
          {treatments.length === 0 ? <NoTreatments /> : null}
        </ul>
      </div>
    </main>
  );
}
