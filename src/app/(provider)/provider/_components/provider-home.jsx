"use client";
import Link from "next/link";

function copy(text) {
  navigator.clipboard.writeText(text);
}

export default function ProviderHome({ user, profile }) {
  return (
    <main className="container max-w-md p-5">
      <div className="mt-6 flex flex-col">
        <h1 className="text-3xl font-bold tracking-tighter">Home</h1>
        <p className="text-sm mt-1">
          Manage your provider workspace and public Ceaute page.
        </p>

        {profile.username ? (
          <span className="mt-6">
            <div className="rounded-xl border p-3">
              <h2 className="text-sm text-pink-600 font-medium">
                Your Ceaute page:
              </h2>
              <p className="mt-1 text-sm">{`ceaute.com/@${profile?.username}`}</p>
            </div>
            <div className="flex items-center justify-end gap-2.5 mt-2">
              <Link
                href={`/@${profile.username}`}
                className="w-max rounded-lg font-semibold hover:border-black/20 border-black/10 text-pink-600 p-1.5 px-3 text-sm border duration-200 active:bg-pink-500/10  active:border-transparent active:text-pink-500 disabled:cursor-not-allowed disabled:opacity-60 aria-disabled:cursor-not-allowed aria-disabled:opacity-50"
              >
                View public page
              </Link>
              <button
                onClick={() => {
                  return copy(`ceaute.com/@${profile.username}`);
                }}
                className="w-max active:opacity-50 rounded-lg font-semibold bg-pink-700  p-1.5 px-3 text-sm  text-white shadow-sm duration-200 hover:bg-pink-800 disabled:cursor-not-allowed disabled:opacity-60 aria-disabled:cursor-not-allowed aria-disabled:opacity-50"
              >
                Copy URL{" "}
              </button>
            </div>
          </span>
        ) : (
          <span className="mt-6">
            <div className="rounded-xl border p-3">
              <h2 className="text-sm text-pink-600 font-medium">
                Your Ceaute page
              </h2>
              <p className="mt-1 text-sm font-medium">
                {" "}
                You don&apos;t have an online profile yet
              </p>
              <Link href={`/provider/page`} className="">
                <p className="text-center active:opacity-50 mt-4 rounded-lg font-semibold bg-pink-700  p-1.5 px-3 text-sm  text-white shadow-sm duration-200 hover:bg-pink-800 disabled:cursor-not-allowed disabled:opacity-60 aria-disabled:cursor-not-allowed aria-disabled:opacity-50">
                  Create your public page
                </p>
              </Link>
            </div>
          </span>
        )}

        <div className="mt-6 grid gap-4 grid-cols-2">
          <Link href="/provider/bookings">
            <div className="h-full items-end flex p-3 duration-200 hover:border-black/20 border rounded-xl">
              <article className="mt-8">
                <h3 className="text-pink-600 font-semibold">Bookings</h3>
                <p className="text-xs mt-1">See all your bookings</p>
              </article>
            </div>
          </Link>
          <Link href="/provider/page">
            <div className="h-full items-end flex p-3 duration-200 hover:border-black/20 border rounded-xl">
              <article className="mt-8">
                <h3 className="text-pink-600 font-semibold">My page</h3>
                <p className="text-xs mt-1">Edit your public page</p>
              </article>
            </div>
          </Link>

          <Link href="/provider/availability">
            <div className="h-full items-end flex p-3 duration-200 hover:border-black/20 border rounded-xl">
              <article className="mt-8">
                <h3 className="text-pink-600 font-semibold">Availability</h3>
                <p className=" text-xs mt-1">Set your opening hours</p>
              </article>
            </div>
          </Link>
          <Link href="/provider/treatments">
            <div className="h-full items-end flex p-3 duration-200 hover:border-black/20 border rounded-xl">
              <article className="mt-8">
                <h3 className="text-pink-600 font-semibold">Treatments</h3>
                <p className=" text-xs mt-1">List your treatments</p>
              </article>
            </div>
          </Link>
        </div>
        <p className="mt-8 text-xs font-semibold text-black/20">{user?.id}</p>
      </div>
    </main>
  );
}
