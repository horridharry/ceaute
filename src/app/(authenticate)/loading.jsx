export default async function Loading() {
  return (
    <main className="container mx-auto max-w-md p-5">
      <div className="mt-12 flex flex-col">
        <div href={"/"} className="flex w-max items-center gap-x-1">
          <span hidden className="relative h-6 w-6 overflow-hidden">
            <div
              className="absolute select-none"
              fill="responsive"
              style={{ objectFit: "cover" }}
              src="/fleekd_logo.png"
              alt="fleekd-company-logo"
            />
          </span>
          <h2 className="select-none text-xs font-bold uppercase tracking-widest opacity-70">
            fleekd
          </h2>
        </div>
        <span className="mt-4 p-6 rounded-xl bg-black/5 w-40"></span>

        <form className="mt-6 grid gap-2">
          <span className="p-4 mt-2  rounded-xl bg-black/5 w-72"></span>
          <span className="p-4 mt-2  rounded-xl bg-black/5 w-72"></span>
        </form>
      </div>
    </main>
  );
}
