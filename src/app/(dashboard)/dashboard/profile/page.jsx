import Link from "next/link";
import {
  getProviderPage,
  publishPage,
  unpublishPage,
  updateProviderPage,
} from "./actions";
import { ProviderPageForm } from "./_components/provider-page-form";
import { PublicationActions } from "./_components/publication-actions";

export default async function DashboardProfilePage() {
  const { providerPage, publication } = await getProviderPage();

  return (
    <>
      <main className="container max-w-md p-5">
        <div className="mt-6">
          <h1 className="text-3xl font-bold tracking-tighter">Page</h1>
          <nav
            aria-label="Page settings"
            className="mt-6 flex flex-wrap gap-x-5 gap-y-2 border-b border-black/10 pb-4 text-sm font-medium"
          >
            <Link href="/dashboard/profile" className="text-pink-600">
              Profile
            </Link>
            <Link
              href="/dashboard/profile/portfolio"
              className="hover:text-pink-600"
            >
              Portfolio
            </Link>
            <Link href="/dashboard/availability" className="hover:text-pink-600">
              Availability
            </Link>
            <Link
              href="/dashboard/profile/preview"
              className="hover:text-pink-600"
            >
              Preview
            </Link>
          </nav>
        </div>

        <section className="mt-8 rounded-xl border p-4 text-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-black/50">
                Page status
              </p>
              <h2 className="mt-1 text-2xl font-bold tracking-tighter capitalize">
                {providerPage.status}
              </h2>
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

          {publication.ready ? null : (
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

          <PublicationActions
            status={providerPage.status}
            ready={publication.ready}
            publishPage={publishPage}
            unpublishPage={unpublishPage}
          />
        </section>
      </main>
      <ProviderPageForm
        providerPage={providerPage}
        updateProviderPage={updateProviderPage}
      />
    </>
  );
}
