import Nav from "@/components/Nav";
import Skeleton, { SkeletonBookingCard } from "@/components/Skeleton";

export default function MeLoading() {
  return (
    <>
      <Nav />
      <main className="pt-24 pb-16">
        <div className="max-w-prose mx-auto px-6">
          <div className="mb-12 space-y-3">
            <Skeleton className="h-9 w-64" />
            <Skeleton className="h-[14px] w-80" />
          </div>

          <div className="flex gap-4 mb-6 border-b border-border pb-3">
            <Skeleton className="h-5 w-16" />
            <Skeleton className="h-5 w-16" />
            <Skeleton className="h-5 w-16" />
          </div>

          <div className="space-y-3">
            <SkeletonBookingCard />
            <SkeletonBookingCard />
            <SkeletonBookingCard />
          </div>
        </div>
      </main>
    </>
  );
}
