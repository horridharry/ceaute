import { Tabs } from "@/components/ui/tabs";

// B7: groups and add-ons stopped being top-level drawer items and became tabs
// inside Treatments. This is the strip that makes that true, shared by all
// three routes so they read as one section rather than three destinations.
export function CatalogueTabs({ value, counts = {} }) {
  const label = (text, count) =>
    Number.isFinite(count) ? `${text} ${count}` : text;

  return (
    <Tabs
      label="Treatments"
      value={value}
      items={[
        {
          value: "treatments",
          label: label("Treatments", counts.treatments),
          href: "/dashboard/treatments",
        },
        {
          value: "groups",
          label: label("Groups", counts.groups),
          href: "/dashboard/treatment-groups",
        },
        {
          value: "add-ons",
          label: label("Add-ons", counts.addOns),
          href: "/dashboard/add-ons",
        },
      ]}
    />
  );
}
