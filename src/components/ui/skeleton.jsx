// Placeholder blocks shown while a route loads. The group is announced once
// as "Loading"; the blocks themselves are hidden from assistive technology,
// and they only pulse when reduced motion is not requested.
import { composeClassName } from "./class-names";
import { PageContainer } from "./page-container";
import { SKELETON_PULSE, skeletonClassName } from "./layout-classes";

export function Skeleton({ rounded = "xl", className = "" }) {
  return <span aria-hidden="true" className={skeletonClassName({ rounded, className })} />;
}

export function SkeletonGroup({ className = "", children }) {
  return (
    <div role="status" className={composeClassName(SKELETON_PULSE, className)}>
      <span className="sr-only">Loading</span>
      {children}
    </div>
  );
}

// The loading state most routes share: a title-sized block over a line.
export function PageSkeleton({ width = "narrow", align = "center", pills = 0, rows = 0 }) {
  return (
    <PageContainer width={width} align={align}>
      <SkeletonGroup className="mt-6 flex flex-col">
        <Skeleton className="w-40 p-6" />
        <Skeleton className="mt-2 w-72 p-4" />
        {pills ? (
          <span aria-hidden="true" className="mt-6 flex gap-2">
            {Array.from({ length: pills }, (_, index) => (
              <span key={index} className="block h-10 w-24 rounded-full bg-surface-subtle" />
            ))}
          </span>
        ) : null}
        {rows ? (
          <span aria-hidden="true" className="mt-6 flex flex-col gap-3">
            {Array.from({ length: rows }, (_, index) => (
              <Skeleton key={index} className="h-18" />
            ))}
          </span>
        ) : null}
      </SkeletonGroup>
    </PageContainer>
  );
}
