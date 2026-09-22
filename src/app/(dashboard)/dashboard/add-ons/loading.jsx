import { PageSkeleton } from "@/components/ui/skeleton";

// The shape of a filtered list: heading, filter pills, rows.
export default function Loading() {
  return <PageSkeleton pills={2} rows={4} />;
}
