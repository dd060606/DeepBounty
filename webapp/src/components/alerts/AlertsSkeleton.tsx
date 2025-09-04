import { Skeleton } from "@/components/ui/skeleton";

export default function AlertsSkeleton() {
  return (
    <div className="space-y-4">
      {/* Search + Filter skeleton */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        {/* Input skeleton */}
        <Skeleton className="h-9 w-full sm:max-w-xl" />

        {/* Filter button skeleton*/}
        <Skeleton className="h-9 w-full rounded-sm sm:w-24" />
      </div>

      {/* Table skeleton */}
      <div className="overflow-hidden rounded-lg border">
        {/* Body rows */}
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="grid grid-cols-3 items-center gap-4 p-4 sm:grid-cols-6 sm:gap-8">
            {/* ID */}
            <Skeleton className="h-4 w-10" />

            {/* Name */}
            <Skeleton className="h-4 w-16 sm:w-36" />

            {/* Company (favicon + two lines)  */}
            <div className="flex items-center gap-3">
              <Skeleton className="h-6 w-6 rounded-sm" />
              <div className="flex flex-col gap-2">
                <Skeleton className="h-4 w-10 sm:w-20" />
                <Skeleton className="h-3 w-10 sm:w-20" />
              </div>
            </div>

            {/* Severity badge */}
            <Skeleton className="hidden h-6 w-20 rounded-full sm:block" />

            {/* Status badge */}
            <Skeleton className="hidden h-6 w-20 rounded-full sm:block" />

            {/* Date */}
            <Skeleton className="hidden h-4 w-40 sm:block" />
          </div>
        ))}
      </div>
    </div>
  );
}
