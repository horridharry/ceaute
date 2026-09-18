import { getSignedInProvider } from "./provider-data";

// The counts on the Treatments tabs. Three head-only counts against tables the
// dashboard already reads, so the numbers are real rather than omitted.
export async function getCatalogueCounts(next = "/dashboard/treatments") {
  const { supabase, providerPage } = await getSignedInProvider({ next });

  const countFor = async (table) => {
    const { count } = await supabase
      .schema("ceaute")
      .from(table)
      .select("id", { count: "exact", head: true })
      .eq("provider_page_id", providerPage.id)
      .eq("is_active", true);

    return count ?? 0;
  };

  const [treatments, groups, addOns] = await Promise.all([
    countFor("treatment"),
    countFor("treatment_group"),
    countFor("treatment_add_on"),
  ]);

  return { treatments, groups, addOns };
}
