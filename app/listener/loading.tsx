import Nav from "@/components/Nav";
import Skeleton, { SkeletonSlotRow } from "@/components/Skeleton";

export default function ListenerLoading() {
  return (
    <>
      <Nav />
      <main className="pt-24 pb-16">
        <div className="max-w-prose mx-auto px-6">
          <div className="mb-10 space-y-2">
            <Skeleton className="h-9 w-40" />
            <Skeleton className="h-[14px] w-32" />
          </div>

          <div className="flex gap-4 mb-6 border-b border-border pb-3">
            <Skeleton className="h-5 w-20" />
            <Skeleton className="h-5 w-20" />
          </div>

          <div className="flex justify-between items-center mb-6">
            <Skeleton className="h-[14px] w-32" />
            <Skeleton className="h-9 w-28 rounded-md" />
          </div>

          <div className="space-y-8">
            {[0, 1].map((i) => (
              <div key={i}>
                <Skeleton className="h-[14px] w-28 mb-3 ml-1" />
                <div className="space-y-2">
                  <SkeletonSlotRow />
                  <SkeletonSlotRow />
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </>
  );
}
