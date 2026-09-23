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
import { DiscoverPhotoHero } from "./_components/discover-photo-hero";
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

// Average and count of visible reviews, or the plain word "New" before the
// first one (approved 23 September 2026). Never invented.
function Rating({ rating }) {
  if (!rating) {
    return <span className="text-sm font-medium text-ink-muted">New</span>;
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

// A Discover card (approved 23 September 2026): a swipeable photo hero, then
// the display photo, business name, public area and rating. The name is the
// card's link and comes first for keyboards and screen readers; the photos
// sit above it visually (order-first) and carry their own pointer links and
// buttons, none nested inside another link.
function ProviderCard({ provider }) {
  const href = `/@${provider.username}`;

  return (
    <article className="flex flex-col gap-2">
      <div className="flex items-center gap-2.5">
        {provider.display_photo_url ? (
          // eslint-disable-next-line @next/next/no-img-element -- Supabase signed URLs are short-lived and not suitable for a static next/image host allowlist.
          <img
            src={provider.display_photo_url}
            alt=""
            loading="lazy"
            decoding="async"
            className="h-9 w-9 shrink-0 rounded-full object-cover"
          />
        ) : null}
        <div className="flex min-w-0 flex-1 flex-col">
          <h2 className="text-base font-semibold [overflow-wrap:anywhere]">
            <Link
              href={href}
              className="rounded-sm hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
            >
              {provider.display_name}
            </Link>
          </h2>
          {provider.public_area ? <p className="text-sm text-ink-muted">{provider.public_area}</p> : null}
        </div>
        <span className="shrink-0">
          <Rating rating={provider.rating} />
        </span>
      </div>
      <div className="order-first">
        <DiscoverPhotoHero photos={provider.photo_urls} href={href} name={provider.display_name} />
      </div>
    </article>
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
