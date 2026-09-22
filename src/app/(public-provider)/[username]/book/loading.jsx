import { PageSkeleton } from "@/components/ui/skeleton";

// Left-aligned like the pages it stands in for, which are not redesigned yet.
export default function Loading() {
  return <PageSkeleton align="start" />;
}
