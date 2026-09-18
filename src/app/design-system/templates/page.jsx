import { notFound } from "next/navigation";
import { TemplateGallery } from "./_components/template-gallery";

// Phase 2 of design_handoff_ceaute_mvp/05-build-order.md rendered for review:
// the five templates from 03-screens.md, each filled with approved components
// only. Unreachable in production, like the component gallery beside it.
export const metadata = { title: "Templates · Ceaute" };

export default function DesignSystemTemplatesPage() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  return <TemplateGallery />;
}
