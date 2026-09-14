import Link from "next/link";
import {
  getProviderPage,
  publishPage,
  unpublishPage,
  updateProviderPage,
} from "./actions";
import { ProviderPageForm } from "./_components/provider-page-form";

export default async function DashboardPageManagementPage() {
  const { providerPage, publication } = await getProviderPage();

  return (
    <>
      <main className="container max-w-md p-5">
        <section className="mt-6 rounded-xl border p-4 text-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-black/50">
                Page status
              </p>
              <h1 className="mt-1 text-2xl font-bold tracking-tighter capitalize">
                {providerPage.status}
              </h1>
            </div>
            {providerPage.status === "published" && providerPage.username ? (
              <Link
                href={`/@${providerPage.username}`}
                className="text-sm font-semibold text-pink-600"
              >
                View live page
              </Link>
            ) : null}
          </div>

          {publication.ready ? (
            <p className="mt-4 text-black/60">
              Your page has everything needed for publication.
            </p>
          ) : (
            <div className="mt-4 text-black/60">
              <p className="font-semibold text-black">
                Missing publication requirements
              </p>
              <ul className="mt-2 list-inside list-disc">
                {publication.missing.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-5 flex justify-end">
            {providerPage.status === "published" ? (
              <form action={unpublishPage}>
                <button
                  type="submit"
                  className="rounded-lg border border-black/10 p-3 px-4 text-sm font-semibold text-pink-600 duration-200 hover:border-black/20"
                >
                  Unpublish page
                </button>
              </form>
            ) : publication.ready && providerPage.status !== "suspended" ? (
              <form action={publishPage}>
                <button
                  type="submit"
                  className="rounded-lg bg-pink-700 p-3 px-4 text-sm font-semibold text-white shadow-sm duration-200 hover:bg-pink-800"
                >
                  Publish page
                </button>
              </form>
            ) : null}
          </div>
        </section>
      </main>
      <ProviderPageForm
        providerPage={providerPage}
        updateProviderPage={updateProviderPage}
      />
    </>
  );
}
