export default function Loading() {
  return (
    <main className="container mx-auto flex min-h-screen max-w-sm items-center px-5 py-12">
      <div className="flex w-full animate-pulse flex-col">
        <h2 className="select-none text-lg font-semibold tracking-tighter">
          Ceaute
        </h2>
        <span className="mt-10 w-40 rounded-lg bg-black/5 p-4"></span>
        <span className="mt-8 w-full rounded-lg bg-black/5 p-6"></span>
        <span className="mt-4 w-full rounded-lg bg-black/5 p-5"></span>
      </div>
    </main>
  );
}
