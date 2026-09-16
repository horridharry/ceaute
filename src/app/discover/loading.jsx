export default function Loading() {
  return (
    <main className="container max-w-md p-5">
      <div className="mt-6 flex flex-col animate-pulse">
        <span className="p-6 rounded-xl bg-black/5 w-40"></span>
        <span className="p-4 mt-2 rounded-xl bg-black/5 w-72"></span>
      </div>
    </main>
  );
}
