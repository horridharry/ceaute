"use client";

import Link from "next/link";

const currencyFormatter = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
});

function formatDurationMinutes(minutes) {
  const safeMinutes = Number.isFinite(Number(minutes)) ? Number(minutes) : 0;
  const hours = Math.floor(safeMinutes / 60);
  const remainingMinutes = safeMinutes % 60;

  return [
    hours ? `${hours} hours` : "",
    remainingMinutes ? `${remainingMinutes} minutes` : "",
  ]
    .filter(Boolean)
    .join(" ");
}

function AddOnState({ isActive }) {
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
        isActive ? "bg-pink-50 text-pink-700" : "bg-black/5 text-black/50"
      }`}
    >
      {isActive ? "Active" : "Archived"}
    </span>
  );
}

function AddOnItem({ addOn }) {
  return (
    <Link href={`/dashboard/add-ons/${addOn.addOnId}/edit`}>
      <article className="rounded-xl border p-3 duration-200 hover:border-black/20 hover:bg-black/5">
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
        <div className="flex items-end justify-between gap-4">
          <h1 className="text-3xl font-bold tracking-tighter">Add-ons</h1>
          <div className="flex items-center gap-2">
            <Link
              href="/dashboard/treatments"
              className="w-max rounded-lg border border-black/10 p-3 px-4 text-sm font-semibold text-pink-600 duration-200 hover:border-black/20 active:border-transparent active:bg-pink-500/10 active:text-pink-500"
            >
              Back
            </Link>
            <Link
              href="/dashboard/add-ons/new"
              className="flex w-max items-center overflow-hidden rounded-3xl bg-white p-1.5 px-3 text-center text-sm font-semibold text-pink-600 duration-300 hover:bg-pink-500/10"
            >
              Create
            </Link>
          </div>
        </div>

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
