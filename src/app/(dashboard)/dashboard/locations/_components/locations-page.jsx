"use client";

import Link from "next/link";
import { useActionState } from "react";
import { PageSectionNav } from "../../_components/page-section-nav";

function ActionMessage({ message }) {
  return message ? (
    <p className="mt-2 text-sm text-black/60">{message}</p>
  ) : null;
}

function describeAddress(location) {
  return [
    location.address_line_1,
    location.address_line_2,
    location.city,
    location.postcode,
  ]
    .filter(Boolean)
    .join(", ");
}

function MakePrimaryForm({ location, makePrimaryAction }) {
  const [message, formAction, pending] = useActionState(makePrimaryAction, "");

  return (
    <form action={formAction} className="flex flex-col items-start">
      <input type="hidden" name="location_id" value={location.id} />
      <button
        type="submit"
        disabled={pending}
        aria-disabled={pending}
        className="w-max rounded-lg border border-black/10 p-3 px-4 text-sm font-semibold text-accent-600 duration-200 hover:border-black/20 disabled:cursor-not-allowed disabled:opacity-60 aria-disabled:cursor-not-allowed aria-disabled:opacity-60"
      >
        {pending ? "Moving..." : "Work from here"}
      </button>
      <ActionMessage message={message} />
    </form>
  );
}

function DeleteLocationForm({ location, deleteAction }) {
  const [message, formAction, pending] = useActionState(deleteAction, "");

  return (
    <form action={formAction} className="flex flex-col items-start">
      <input type="hidden" name="location_id" value={location.id} />
      <button
        type="submit"
        disabled={pending}
        aria-disabled={pending}
        className="w-max rounded-lg p-3 px-4 text-sm font-semibold text-rose-600 duration-200 hover:bg-rose-50/80 active:bg-rose-600 active:text-white disabled:cursor-not-allowed disabled:opacity-60 aria-disabled:cursor-not-allowed aria-disabled:opacity-60"
      >
        {pending ? "Deleting..." : "Delete"}
      </button>
      <ActionMessage message={message} />
    </form>
  );
}

function LocationCard({ location, makePrimaryAction, deleteAction }) {
  const address = describeAddress(location);

  return (
    <li
      className={`list-none rounded-xl border p-3 ${
        location.is_primary ? "border-accent-600" : "border-black/10"
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="font-medium">
            {location.public_area || "No public area yet"}
          </h3>
          <p className="mt-1 text-sm text-black/60">
            {address || "No address yet"}
          </p>
          {location.is_primary ? (
            <p className="mt-2 text-xs font-semibold tracking-wide text-accent-700 uppercase">
              Working here now
            </p>
          ) : null}
        </div>
        <Link
          href={`/dashboard/locations/${location.id}/edit`}
          className="w-max rounded-lg border border-black/10 p-3 px-4 text-sm font-semibold text-accent-600 duration-200 hover:border-black/20"
        >
          Edit
        </Link>
      </div>

      <div className="mt-4 flex flex-wrap items-start gap-2">
        {location.is_primary ? null : (
          <MakePrimaryForm
            location={location}
            makePrimaryAction={makePrimaryAction}
          />
        )}
        {location.is_primary ? null : (
          <DeleteLocationForm location={location} deleteAction={deleteAction} />
        )}
      </div>
    </li>
  );
}

export function LocationsPage({ locations, makePrimaryAction, deleteAction }) {
  return (
    <main className="container max-w-md p-5">
      <div className="mt-6 flex flex-col">
        <PageSectionNav
          action={{ label: "+ Add", href: "/dashboard/locations/new" }}
        />

        {locations.length === 0 ? (
          <p className="mt-10 text-sm text-black/60">
            You have not saved a location yet. Add one so customers can find you
            and book.
          </p>
        ) : (
          <ul className="mt-10 flex flex-col gap-4">
            {locations.map((location) => (
              <LocationCard
                key={location.id}
                location={location}
                makePrimaryAction={makePrimaryAction}
                deleteAction={deleteAction}
              />
            ))}
          </ul>
        )}

        <p className="mt-6 text-sm text-black/60">
          Changing where you work from does not move bookings that are already
          confirmed. Those stay at the address the customer agreed to.
        </p>
      </div>
    </main>
  );
}
