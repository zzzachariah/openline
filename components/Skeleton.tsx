type SkeletonProps = {
  className?: string;
};

export default function Skeleton({ className = "" }: SkeletonProps) {
  return (
    <div
      className={`bg-border/60 dark:bg-border rounded animate-pulse ${className}`}
      aria-hidden="true"
    />
  );
}

export function SkeletonCard({ children }: { children: React.ReactNode }) {
  return <div className="card">{children}</div>;
}

export function SkeletonBookingCard() {
  return (
    <div className="card flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div className="space-y-2 flex-1 min-w-0">
        <Skeleton className="h-[18px] w-56" />
        <Skeleton className="h-[14px] w-32" />
        <div className="flex gap-2 pt-1">
          <Skeleton className="h-5 w-12 rounded-full" />
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
      </div>
      <Skeleton className="h-9 w-24 rounded-md shrink-0" />
    </div>
  );
}

export function SkeletonSlotRow() {
  return (
    <div className="card flex items-center justify-between gap-4">
      <div className="space-y-1.5">
        <Skeleton className="h-[18px] w-40" />
        <Skeleton className="h-[14px] w-20" />
      </div>
      <Skeleton className="h-4 w-12" />
    </div>
  );
}
