import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import Skeleton from "@/components/Skeleton";

function SkeletonSlotButton() {
  return (
    <div className="card flex items-center justify-between gap-4">
      <div className="space-y-1.5">
        <Skeleton className="h-[18px] w-40" />
        <Skeleton className="h-[14px] w-24" />
      </div>
      <Skeleton className="h-4 w-12" />
    </div>
  );
}

export default function BookLoading() {
  return (
    <>
      <Nav />
      <main className="pt-24 pb-16 min-h-screen">
        <div className="max-w-[640px] mx-auto px-6">
          <Skeleton className="h-9 w-48 mb-3" />
          <Skeleton className="h-[14px] w-full max-w-md mb-10" />

          <div className="space-y-10">
            {[0, 1].map((i) => (
              <div key={i}>
                <Skeleton className="h-[14px] w-28 mb-3 ml-1" />
                <div className="space-y-2">
                  <SkeletonSlotButton />
                  <SkeletonSlotButton />
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
