import Form from "next/form";
import AppHeader from "@/components/app-header/app-header";
import { ListGroup, ListTemplate } from "@/components/templates/list-template";
import { Chip, ChipRow } from "@/components/ui/chip";
import { EmptyState } from "@/components/ui/empty-state";
import { SearchInput } from "@/components/ui/field";
import { ProblemNotice } from "@/components/ui/notice";
import { ProviderCard } from "@/components/ui/provider-card";
import { getDiscoveryCategories, searchPublicProviders } from "./actions";
import { formatPricePence } from "../(public-provider)/[username]/_lib/public-provider-format";

// T1 · List. Discover is the launch home for everyone, so the providers are
// the product: with no query it is a masthead over the published list rather
// than a prompt to search. The query that fills it is the one this route
// already ran — the page simply stopped hiding its results.
//
// Search keeps both dimensions the route already had, a free-text `area` and a
// `category` slug, with the designed controls: the one filled input in the
// product, and a chip row. The dedicated area picker is deferred; while areas
// fit a text field this is the same search.

// The lowest price among the treatments this search matched. Derived from rows
// the query already returns, so it costs no extra read.
function fromPriceLabel(treatments) {
  const prices = (treatments ?? [])
    .map((treatment) => Number(treatment?.price_pence))
    .filter((price) => Number.isFinite(price) && price > 0);

  return prices.length ? formatPricePence(Math.min(...prices)) : "";
}

function categoryHref({ slug = "", area = "" } = {}) {
  const params = new URLSearchParams();
  if (slug) params.set("category", slug);
  if (area) params.set("area", area);
  const query = params.toString();

  return query ? `/discover?${query}` : "/discover";
}

function discoverTitle({ search, categories }) {
  const category = categories.find(
    (entry) => entry.slug === search.category,
  )?.name;

  if (category && search.area) return `${category} in ${search.area}`;
  if (category) return category;
  if (search.area) return `Providers in ${search.area}`;

  return "Nails, lashes, hair, brows.";
}

function DiscoverFilters({ categories, search }) {
  return (
    <>
      {/* next/form keeps this a plain GET, so a search stays a shareable URL
          and the back button behaves. The category travels as a hidden field
          so typing an area does not silently drop the chip. */}
      <Form action="/discover">
        <input type="hidden" name="category" value={search.category} />
        <SearchInput
          name="area"
          defaultValue={search.area}
          placeholder="Treatment or place — or neither"
          aria-label="Search by area"
        />
      </Form>

      <ChipRow>
        <Chip
          label="All"
          href={categoryHref({ area: search.area })}
          selected={!search.category}
        />
        {categories.map((category) => (
          <Chip
            key={category.slug}
            label={category.name}
            href={categoryHref({ slug: category.slug, area: search.area })}
            selected={category.slug === search.category}
          />
        ))}
      </ChipRow>
    </>
  );
}

export default async function DiscoverPage({ searchParams }) {
  const resolvedSearchParams = await searchParams;
  const [categories, searchResult] = await Promise.all([
    getDiscoveryCategories(),
    searchPublicProviders(resolvedSearchParams),
  ]);

  const { search, results } = searchResult;
  const searched = Boolean(search.area || search.category);
  const noun = results.length === 1 ? "provider" : "providers";

  return (
    <>
      <AppHeader />
      <ListTemplate
        title={discoverTitle({ search, categories })}
        meta={
          searched
            ? `${results.length} ${noun}`
            : `${results.length} independent ${
                results.length === 1 ? "tech" : "techs"
              } booking on Ceaute.`
        }
        filters={<DiscoverFilters categories={categories} search={search} />}
      >
        {search.error ? (
          <ProblemNotice title="That search could not run">
            {search.error}
          </ProblemNotice>
        ) : results.length === 0 ? (
          <EmptyState
            title="Nothing matches that yet"
            actionHref="/discover"
            actionLabel="See everyone"
          >
            Try a wider area, or browse by category.
          </EmptyState>
        ) : (
          <ListGroup>
            {results.map((provider) => (
              <ProviderCard
                key={provider.username}
                href={`/@${provider.username}`}
                name={provider.display_name}
                imageUrl={provider.portfolio_image_url}
                category={provider.provider_category}
                area={provider.public_area}
                fromPriceLabel={fromPriceLabel(provider.matching_treatments)}
              />
            ))}
          </ListGroup>
        )}
      </ListTemplate>
    </>
  );
}
