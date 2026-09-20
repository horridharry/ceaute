// Restores the route's Suspense boundary so navigating to /discover commits
// immediately instead of blocking on the search. It paints the heading that is
// on the page either way -- no skeleton shapes and no spinner (04-decisions);
// the results stream in underneath as soon as the query returns.
export default function Loading() {
  return (
    <main className="container max-w-md p-5 bg-white">
      <div className="mt-6 flex flex-col">
        <h1 className="text-3xl font-bold tracking-tighter">Discover</h1>
      </div>
    </main>
  );
}
