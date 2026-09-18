import { notFound } from "next/navigation";
import { ComponentGallery } from "./_components/component-gallery";

// A review surface for the component library, not a product screen. It exists
// so phase 1 of design_handoff_ceaute_mvp/05-build-order.md can be checked
// against "Ceaute MVP Spec.dc.html" §2 side by side, and it is unreachable in
// production so it never becomes one.
export const metadata = { title: "Components · Ceaute" };

export default function DesignSystemPage() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  return <ComponentGallery />;
}
