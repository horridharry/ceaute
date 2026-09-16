export default function Loading() {
  return (
    <main className="container mx-auto flex min-h-screen max-w-md items-center justify-center p-2">
      <div className="flex w-full flex-col rounded-2xl border border-black/10 bg-white p-8 animate-pulse">
        <h2 className="select-none text-xs font-bold uppercase tracking-widest opacity-70">
          ceaute
        </h2>
        <span className="mt-8 p-4 rounded-xl bg-black/5 w-40"></span>
        <span className="mt-6 p-6 rounded-xl bg-black/5 w-full"></span>
        <span className="mt-4 p-5 rounded-xl bg-black/5 w-full"></span>
      </div>
    </main>
  );
}
