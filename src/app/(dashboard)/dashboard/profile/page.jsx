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
                className="text-sm font-semibold text-plum"
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
