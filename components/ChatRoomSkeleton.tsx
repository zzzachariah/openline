import Skeleton from "./Skeleton";

export default function ChatRoomSkeleton() {
  return (
    <div className="flex flex-col h-screen">
      <header className="sticky top-0 z-20 bg-background border-b border-border">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-20" />
        </div>
      </header>
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 space-y-6">
          <div className="flex justify-start">
            <Skeleton className="h-12 w-2/3 rounded-2xl rounded-bl-sm" />
          </div>
          <div className="flex justify-end">
            <Skeleton className="h-10 w-1/2 rounded-2xl rounded-br-sm" />
          </div>
          <div className="flex justify-start">
            <Skeleton className="h-16 w-3/4 rounded-2xl rounded-bl-sm" />
          </div>
          <div className="flex justify-end">
            <Skeleton className="h-10 w-2/5 rounded-2xl rounded-br-sm" />
          </div>
        </div>
      </div>
      <div className="border-t border-border bg-background">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-3">
          <Skeleton className="h-11 w-full rounded-md" />
        </div>
      </div>
    </div>
  );
}
