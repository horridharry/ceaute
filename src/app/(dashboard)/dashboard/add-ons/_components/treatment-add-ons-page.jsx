import Link from "next/link";
import { SectionHeading } from "../../_components/section-heading";
import { StatusBadge } from "../../_components/status-badge";
import { formatDurationMinutes } from "../../_lib/price-duration";

const currencyFormatter = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
});

function AddOnState({ isActive }) {
  return (
    <StatusBadge
      tone={isActive ? "active" : "neutral"}
      className="font-medium"
    >
      {isActive ? "Active" : "Archived"}
    </StatusBadge>
  );
}

function AddOnItem({ addOn }) {
  return (
    <Link href={`/dashboard/add-ons/${addOn.addOnId}/edit`}>
      <article className="rounded-xl border border-black/10 p-3 duration-200 hover:border-black/20 hover:bg-black/5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <h2 className="truncate font-medium">{addOn.name}</h2>
            <div className="mt-3 flex flex-wrap gap-x-1 gap-y-1 text-sm font-medium">
              <span>{currencyFormatter.format(addOn.additional_price)}</span>
              <span>•</span>
              <span>
                {addOn.additional_duration_minutes
                  ? formatDurationMinutes(addOn.additional_duration_minutes)
                  : "No extra time"}
              </span>
            </div>
            <p className="mt-2 text-xs text-black/50">
              {addOn.compatible_treatment_count === 1
                ? "1 compatible treatment"
                : `${addOn.compatible_treatment_count} compatible treatments`}
            </p>
          </div>
          <AddOnState isActive={addOn.is_active} />
        </div>
      </article>
    </Link>
  );
}

function AddOnList({ title, addOns, emptyMessage }) {
  return (
    <section className="mt-10">
      <h2 className="text-lg font-semibold">{title}</h2>
      {addOns.length === 0 ? (
        <p className="mt-3 text-sm text-black/60">{emptyMessage}</p>
      ) : (
        <ul className="mt-4 flex flex-col gap-4">
          {addOns.map((addOn) => (
            <li key={addOn.addOnId} className="list-none">
              <AddOnItem addOn={addOn} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function TreatmentAddOnsPage({ addOns }) {
  const activeAddOns = addOns.filter((addOn) => addOn.is_active);
  const archivedAddOns = addOns.filter((addOn) => !addOn.is_active);

  return (
    <main className="container max-w-md p-5">
      <div className="mt-6 flex flex-col">
        <SectionHeading title="Add-ons" newHref="/dashboard/add-ons/new" />

        <AddOnList
          title="Active add-ons"
          addOns={activeAddOns}
          emptyMessage="No active add-ons yet."
        />
        <AddOnList
          title="Archived add-ons"
          addOns={archivedAddOns}
          emptyMessage="No archived add-ons."
        />
      </div>
    </main>
  );
}
