import { PageSkeleton } from "@/components/ui/skeleton";

// Centred like every dashboard page: a heading and a few rows.
export default function Loading() {
  return <PageSkeleton rows={3} />;
}
