import { PageContainer } from "@/components/ui/page-container";
import { Skeleton, SkeletonGroup } from "@/components/ui/skeleton";

// The sign-in card shape: the wordmark, a heading line, a field and a button.
export default function Loading() {
  return (
    <PageContainer width="auth">
      <SkeletonGroup className="flex w-full flex-col">
        <h2 className="select-none text-lg font-semibold tracking-tighter">
          Ceaute
        </h2>
        <Skeleton rounded="lg" className="mt-10 w-40 p-4" />
        <Skeleton rounded="lg" className="mt-8 w-full p-6" />
        <Skeleton rounded="lg" className="mt-4 w-full p-5" />
      </SkeletonGroup>
    </PageContainer>
  );
}
