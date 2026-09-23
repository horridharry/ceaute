import { PageSkeleton } from "@/components/ui/skeleton";

// Discover's wide, centred column.
export default function Loading() {
  return <PageSkeleton width="wide" rows={3} />;
}
