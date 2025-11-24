import { Skeleton } from "@/components/ui/skeleton";

export default function NotificationServicesSkeleton() {
  return (
    <div className="space-y-6">
      {/* Service buttons */}
      <div className="flex flex-wrap gap-3">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-24 w-28" />
        ))}
      </div>

      {/* Settings section */}
      <div className="space-y-4">
        <div>
          <Skeleton className="mb-2 h-5 w-48" />
          <Skeleton className="h-4 w-96" />
        </div>
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-start justify-between gap-4">
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-64" />
              </div>
              <Skeleton className="h-9 w-32" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
