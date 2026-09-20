import Link from "next/link";
import Form from "next/form";
import { PendingButton } from "@/components/pending-button";
import {
  getDiscoveryCategories,
  searchPublicProviders,
} from "./actions";
import { formatPricePence } from "../(public-provider)/[username]/_lib/public-provider-format";

// The card states the cheapest way in rather than listing every treatment; the
// full menu is one tap away on the provider's own page.
const fromPricePence = (treatments) => {
  const prices = treatments
    .map((treatment) => Number(treatment?.price_pence))
    .filter((price) => Number.isInteger(price) && price >= 0);

  return prices.length ? Math.min(...prices) : null;
};

function SearchForm({ categories, search }) {
  return (
    <Form action="/discover" className="mt-6 flex flex-col">
      <div className="flex gap-2">
        <select
          name="category"
          aria-label="Treatment category"
          defaultValue={search.category}
          className="field min-w-0 flex-1 cursor-pointer"
        >
          <option value="">All categories</option>
          {categories.map((category) => (
            <option key={category.slug} value={category.slug}>
              {category.name}
            </option>
          ))}
        </select>
        <input
          name="area"
          type="search"
          maxLength={120}
          aria-label="Area"
          defaultValue={search.area}
          placeholder="Anywhere"
          className="field min-w-0 flex-1"
        />
      </div>

      <PendingButton
        pendingLabel="Searching..."
        className="mt-2 w-full rounded-[11px] bg-accent-600 py-3.5 text-sm font-medium text-white disabled:opacity-40"
      >
        Search
      </PendingButton>
    </Form>
  );
}

function ProviderImage({ provider }) {
  if (!provider.portfolio_image_url) {
    return (
      <div className="flex aspect-[5/2] w-full bg-black/5">
        <p className="m-auto text-xs text-black/45">No image yet</p>
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element -- Supabase signed URLs are short-lived and not suitable for a static next/image host allowlist.
    <img
      src={provider.portfolio_image_url}
      alt=""
      className="aspect-[5/2] w-full object-cover"
    />
  );
}

function ProviderCard({ provider }) {
  const pricePence = fromPricePence(provider.matching_treatments);
  const meta = [provider.provider_category, provider.public_area]
    .filter(Boolean)
    .join(" · ");

  return (
    <Link
      href={`/@${provider.username}`}
      className="block overflow-hidden rounded-[15px] border border-black/10"
    >
      <ProviderImage provider={provider} />
      <div className="flex items-start justify-between gap-3 p-3">
        <div className="min-w-0">
          <h2 className="truncate font-semibold tracking-tight">
            {provider.display_name}
          </h2>
          {meta ? (
            <p className="mt-0.5 truncate text-xs text-black/50">{meta}</p>
          ) : null}
        </div>
        {pricePence === null ? null : (
          <p className="shrink-0 text-right text-sm font-medium tabular-nums">
            {formatPricePence(pricePence)}
            <span className="block text-xs font-normal text-black/45">
              from
            </span>
          </p>
        )}
      </div>
    </Link>
  );
}

// An empty result is a content problem, not an error: say what was searched,
// then offer the moves that widen it.
function NothingFound({ search, categories }) {
  const categoryName = categories.find(
    (category) => category.slug === search.category,
  )?.name;

  if (!search.area && !search.category) {
    return (
      <div className="mt-10">
        <h2 className="text-lg font-semibold tracking-tight">
          No published providers yet
        </h2>
        <p className="mt-1.5 text-sm text-black/60">
          Pages appear here as soon as they are published.
        </p>
      </div>
    );
  }

  const subject = categoryName ? categoryName.toLowerCase() : "providers";
  const place = search.area ? ` in ${search.area}` : "";

  return (
    <div className="mt-10">
      <h2 className="text-lg font-semibold tracking-tight">
        No {subject}
        {place} yet
      </h2>
      <p className="mt-1.5 text-sm text-black/60">
        Try a wider area, or a different category.
      </p>
      <div className="mt-4 flex flex-col gap-2">
        {search.area && search.category ? (
          <Link
            href={`/discover?category=${encodeURIComponent(search.category)}`}
            className="rounded-[11px] bg-ink py-3 text-center text-sm font-medium text-white"
          >
            Show {subject} anywhere
          </Link>
        ) : null}
        <Link
          href="/discover"
          className="rounded-[11px] border border-black/16 py-3 text-center text-sm font-medium"
        >
          Browse all providers
        </Link>
      </div>
    </div>
  );
}

function SearchResults({ results, search, categories }) {
  if (results.length === 0) {
    return <NothingFound search={search} categories={categories} />;
  }

  return (
    <>
      <p className="mt-6 text-xs text-black/50">
        {results.length} {results.length === 1 ? "provider" : "providers"}
      </p>
      <ul className="mt-2 flex flex-col gap-2.5">
        {results.map((provider) => (
          <li key={provider.username}>
            <ProviderCard provider={provider} />
          </li>
        ))}
      </ul>
    </>
  );
}

export default async function DiscoverPage({ searchParams }) {
  const resolvedSearchParams = await searchParams;
  const [categories, searchResult] = await Promise.all([
    getDiscoveryCategories(),
    searchPublicProviders(resolvedSearchParams),
  ]);

  return (
    <main className="container max-w-md p-5 bg-white">
      <div className="mt-6 flex flex-col">
        <h1 className="text-3xl font-bold tracking-tighter">Discover</h1>

        <SearchForm categories={categories} search={searchResult.search} />

        {searchResult.search.error ? (
          <p className="mt-6 rounded-xl bg-surface p-4 text-sm text-black/70">
            {searchResult.search.error}
          </p>
        ) : (
          <SearchResults
            results={searchResult.results}
            search={searchResult.search}
            categories={categories}
          />
        )}
      </div>
    </main>
  );
}
