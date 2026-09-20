import Link from "next/link";
import Form from "next/form";
import { PendingButton } from "@/components/pending-button";
import {
  getDiscoveryCategories,
  searchPublicProviders,
} from "./actions";
import { formatPricePence } from "../(public-provider)/[username]/_lib/public-provider-format";

const treatmentSummary = (treatments) =>
  treatments
    .map((treatment) => {
      const name = treatment?.name ?? "Treatment";
      const price = Number.isInteger(Number(treatment?.price_pence))
        ? formatPricePence(treatment.price_pence)
        : "Price unavailable";

      return `${name} (${price})`;
    })
    .join(", ");

function SearchForm({ categories, search }) {
  return (
    <Form action="/discover" className="mt-8 flex flex-col gap-4">
      <div>
        <label htmlFor="area" className="label">
          Public area
        </label>
        <input
          id="area"
          name="area"
          type="search"
          maxLength={120}
          defaultValue={search.area}
          placeholder="Shoreditch, London"
          className="field mt-1 w-full"
        />
      </div>

      <div>
        <label htmlFor="category" className="label">
          Treatment category
        </label>
        <select
          id="category"
          name="category"
          defaultValue={search.category}
          className="field mt-1 w-full cursor-pointer"
        >
          <option value="">All categories</option>
          {categories.map((category) => (
            <option key={category.slug} value={category.slug}>
              {category.name}
            </option>
          ))}
        </select>
      </div>

      <PendingButton
        pendingLabel="Searching..."
        className="w-max rounded-lg bg-accent-700 p-3 px-4 text-sm font-semibold text-white shadow-sm duration-200 hover:bg-accent-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        Search
      </PendingButton>
    </Form>
  );
}

function ProviderImage({ provider }) {
  if (!provider.portfolio_image_url) {
    return (
      <div className="flex aspect-[4/3] w-full rounded-lg border bg-black/5">
        <p className="m-auto text-sm text-black/50">No image yet</p>
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element -- Supabase signed URLs are short-lived and not suitable for a static next/image host allowlist.
    <img
      src={provider.portfolio_image_url}
      alt=""
      className="aspect-[4/3] w-full rounded-lg object-cover"
    />
  );
}

function SearchResults({ results, searched }) {
  if (!searched) {
    return (
      <p className="mt-10 rounded-xl border p-4 text-sm text-black/60">
        Search by area, treatment category or both.
      </p>
    );
  }

  if (results.length === 0) {
    return (
      <p className="mt-10 rounded-xl border p-4 text-sm text-black/60">
        No published providers matched that search.
      </p>
    );
  }

  return (
    <ul className="mt-10 flex flex-col gap-4">
      {results.map((provider) => (
        <li key={provider.username}>
          <article className="rounded-xl border p-3">
            <ProviderImage provider={provider} />
            <div className="mt-3">
              <h2 className="text-lg font-semibold">{provider.display_name}</h2>
              <p className="text-sm text-black/60">@{provider.username}</p>
              <p className="mt-2 text-sm">{provider.provider_category}</p>
              {provider.public_area ? (
                <p className="text-sm text-black/60">{provider.public_area}</p>
              ) : null}
              <p className="mt-3 text-sm">
                {treatmentSummary(provider.matching_treatments) ||
                  "Treatments unavailable"}
              </p>
              <Link
                href={`/@${provider.username}`}
                className="mt-4 block w-max rounded-lg border border-black/10 p-2 px-4 text-sm font-semibold text-accent-600 duration-200 hover:border-black/20"
              >
                View page
              </Link>
            </div>
          </article>
        </li>
      ))}
    </ul>
  );
}

export default async function DiscoverPage({ searchParams }) {
  const resolvedSearchParams = await searchParams;
  const [categories, searchResult] = await Promise.all([
    getDiscoveryCategories(),
    searchPublicProviders(resolvedSearchParams),
  ]);
  const searched = Boolean(
    searchResult.search.area || searchResult.search.category,
  );

  return (
    <main className="container max-w-md p-5 bg-white">
      <div className="mt-6 flex flex-col">
        <h1 className="text-3xl font-bold tracking-tighter">Discover</h1>
        <p className="mt-1 text-sm">
          Find published providers by public area and treatment category.
        </p>

        <SearchForm categories={categories} search={searchResult.search} />

        {searchResult.search.error ? (
          <p className="mt-6 rounded-xl border border-red-200 p-4 text-sm text-red-700">
            {searchResult.search.error}
          </p>
        ) : (
          <SearchResults results={searchResult.results} searched={searched} />
        )}
      </div>
    </main>
  );
}
