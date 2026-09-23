import Link from "next/link";
import Form from "next/form";
import { unstable_rethrow } from "next/navigation";
import { buttonClassName } from "@/components/ui/button-classes";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Notice } from "@/components/ui/notice";
import { PageContainer } from "@/components/ui/page-container";
import { PageHeading } from "@/components/ui/page-heading";
import { PendingButton } from "@/components/ui/pending-button";
import { Select } from "@/components/ui/select";
import {
  DISCOVER_PAGE_SIZE,
  discoverProviders,
  getDiscoveryCategories,
} from "./queries";

function SearchForm({ categories, search }) {
  return (
    <Form
      action="/discover"
      role="search"
      aria-label="Find providers"
      className="mt-6 grid gap-3 sm:grid-cols-[minmax(0,1fr)_220px_auto] sm:items-end"
    >
      <span className="flex flex-col gap-1.5">
        <label htmlFor="area" className="label">
          Area
        </label>
        <Input
          id="area"
          name="area"
          type="search"
          maxLength={120}
          defaultValue={search.area}
          placeholder="Peckham, London"
          autoComplete="off"
        />
      </span>
      <span className="flex flex-col gap-1.5">
        <label htmlFor="category" className="label">
          Treatment
        </label>
        <Select id="category" name="category" defaultValue={search.category}>
          <option value="">All treatments</option>
          {categories.map((category) => (
            <option key={category.slug} value={category.slug}>
              {category.name}
            </option>
          ))}
        </Select>
      </span>
      <PendingButton pendingLabel="Searching…" className="w-max">
        Search
      </PendingButton>
    </Form>
  );
}

// Average and count of visible reviews, or "New" before the first one: the
// storefront's convention. Never invented.
function Rating({ rating }) {
  if (!rating) {
    return (
      <span className="inline-flex items-center rounded-full border border-line px-2.5 py-0.5 text-xs font-semibold text-ink-muted">
        New
      </span>
    );
  }

  return (
    <span className="whitespace-nowrap text-sm font-semibold tabular-nums">
      <span aria-hidden="true">★ </span>
      {rating.average}
      <span className="sr-only"> out of 5 from {rating.countLabel}</span>
      <span aria-hidden="true" className="font-normal text-ink-muted">
        {" "}
        ({rating.count})
      </span>
    </span>
  );
}

const BENTO_LAYOUT = {
  1: "grid-cols-1",
  2: "grid-cols-2",
  3: "grid-cols-[2fr_1fr] grid-rows-2",
};

// Discover card B (chosen 23 September 2026): up to three portfolio photos,
// then the display photo, business name, public area and rating. The whole
// card is one link; the photos are decoration for it.
function ProviderCard({ provider }) {
  const photos = provider.photo_urls;

  return (
    <Link
      href={`/@${provider.username}`}
      className="group flex flex-col gap-2 rounded-xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-focus"
    >
      {photos.length ? (
        <span
          aria-hidden="true"
          className={`grid aspect-[4/3] max-w-full gap-[3px] overflow-hidden rounded-xl bg-surface-subtle ${BENTO_LAYOUT[photos.length]}`}
        >
          {photos.map((url, index) => (
            // eslint-disable-next-line @next/next/no-img-element -- Supabase signed URLs are short-lived and not suitable for a static next/image host allowlist.
            <img
              key={url}
              src={url}
              alt=""
              loading="lazy"
              decoding="async"
              className={`h-full w-full min-h-0 object-cover ${photos.length === 3 && index === 0 ? "row-span-2" : ""}`}
            />
          ))}
        </span>
      ) : (
        <span aria-hidden="true" className="block aspect-[4/3] max-w-full rounded-xl bg-surface-subtle" />
      )}
      <span className="flex items-center gap-2.5">
        {provider.display_photo_url ? (
          // eslint-disable-next-line @next/next/no-img-element -- as above.
          <img
            src={provider.display_photo_url}
            alt=""
            loading="lazy"
            decoding="async"
            className="h-9 w-9 shrink-0 rounded-full object-cover"
          />
        ) : null}
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="font-semibold [overflow-wrap:anywhere] group-hover:underline">{provider.display_name}</span>
          {provider.public_area ? <span className="text-sm text-ink-muted">{provider.public_area}</span> : null}
        </span>
        <span className="shrink-0">
          <Rating rating={provider.rating} />
        </span>
      </span>
    </Link>
  );
}

function resultLabel({ total, search, categoryName }) {
  const providers = `${total} ${total === 1 ? "provider" : "providers"}`;
  const where = search.area ? ` in “${search.area}”` : "";
  const what = categoryName ? ` for ${categoryName}` : "";
  return `${providers}${where}${what}`;
}

function showMoreHref({ search, shown }) {
  const params = new URLSearchParams();
  if (search.area) params.set("area", search.area);
  if (search.category) params.set("category", search.category);
  params.set("shown", String(shown + DISCOVER_PAGE_SIZE));
  return `/discover?${params.toString()}`;
}

async function loadProviders(searchParams) {
  try {
    return { result: await discoverProviders(searchParams), failed: false };
  } catch (error) {
    unstable_rethrow(error);
    console.error(error);
    return { result: null, failed: true };
  }
}

export default async function DiscoverPage({ searchParams }) {
  const params = await searchParams;
  const [categories, { result, failed }] = await Promise.all([
    getDiscoveryCategories(),
    loadProviders(params ?? {}),
  ]);
  const search = result?.search ?? { area: String(params?.area ?? ""), category: String(params?.category ?? ""), error: "" };
  const searched = Boolean(search.area || search.category);
  const categoryName = categories.find((category) => category.slug === search.category)?.name ?? "";

  return (
    <PageContainer width="wide">
      <PageHeading title="Discover" description="Book independent beauty providers near you." />
      <SearchForm categories={categories} search={search} />

      {failed ? (
        <Notice role="alert" className="mt-6">
          Discover isn’t working right now. Try again in a moment.
        </Notice>
      ) : search.error ? (
        <Notice role="alert" className="mt-6">
          {search.error}
        </Notice>
      ) : result.providers.length === 0 ? (
        <EmptyState
          variant="bounded"
          className="mt-6"
          action={
            searched ? (
              <Link href="/discover" className={buttonClassName({ variant: "secondary" })}>
                Show all providers
              </Link>
            ) : null
          }
        >
          {searched
            ? `No providers match${search.area ? ` “${search.area}”` : ""}${categoryName ? ` in ${categoryName}` : ""} yet. Try a nearby area or all treatments.`
            : "No providers are taking bookings on Ceaute yet."}
        </EmptyState>
      ) : (
        <>
          <p role="status" className="mt-6 text-sm text-ink-muted">
            {resultLabel({ total: result.total, search, categoryName })}
          </p>
          <ul className="mt-4 grid grid-cols-1 gap-x-5 gap-y-7 sm:grid-cols-2 lg:grid-cols-3">
            {result.providers.map((provider) => (
              <li key={provider.username}>
                <ProviderCard provider={provider} />
              </li>
            ))}
          </ul>
          {result.total > result.providers.length ? (
            <p className="mt-8 flex justify-center">
              <Link href={showMoreHref({ search, shown: result.shown })} scroll={false} className={buttonClassName({ variant: "outline" })}>
                Show more
              </Link>
            </p>
          ) : null}
        </>
      )}
    </PageContainer>
  );
}
