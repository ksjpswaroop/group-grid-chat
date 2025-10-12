import { Skeleton } from "@/components/ui/skeleton";

interface MessageSkeletonProps {
  count?: number;
}

export function MessageSkeleton({ count = 5 }: MessageSkeletonProps) {
  return (
    <div className="space-y-4 p-4" role="status" aria-label="Loading messages">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex gap-3">
          <Skeleton className="h-10 w-10 rounded-full flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="flex items-center gap-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-3 w-16" />
            </div>
            <Skeleton className="h-16 w-full" />
          </div>
        </div>
      ))}
      <span className="sr-only">Loading messages...</span>
    </div>
  );
}

export function ChannelListSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="space-y-1 p-2" role="status" aria-label="Loading channels">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center gap-2 p-2">
          <Skeleton className="h-4 w-4" />
          <Skeleton className="h-4 flex-1" />
        </div>
      ))}
      <span className="sr-only">Loading channels...</span>
    </div>
  );
}

export function UserListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-3 p-4" role="status" aria-label="Loading users">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <Skeleton className="h-8 w-8 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-24" />
          </div>
        </div>
      ))}
      <span className="sr-only">Loading users...</span>
    </div>
  );
}
