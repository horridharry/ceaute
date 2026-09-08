export default function Loading() {
  return (
    <main className="container mx-auto w-full max-w-md p-5">
      <div className="mt-12 flex flex-col" aria-label="Loading sign in">
        <span className="select-none text-xs font-bold uppercase tracking-widest opacity-70">
          Ceaute
        </span>
        <span className="mt-8 h-8 w-28 animate-pulse rounded-lg bg-black/5" />
        <span className="mt-3 h-5 w-40 animate-pulse rounded-lg bg-black/5" />
        <div className="mt-6 grid gap-3">
          <span className="h-4 w-12 animate-pulse rounded bg-black/5" />
          <span className="h-12 w-full animate-pulse rounded-xl bg-black/5" />
          <span className="mt-2 h-11 w-full animate-pulse rounded-lg bg-black/5" />
        </div>
      </div>
    </main>
  );
}
