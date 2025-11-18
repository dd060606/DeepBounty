import { Skeleton } from "@/components/ui/skeleton";

export default function WorkersSkeleton() {
  return (
    <div>
      <Skeleton className="mb-4 h-5 w-48" />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="border-border bg-card/50 rounded-lg border p-4">
            <div className="mb-3 flex items-start justify-between">
              <div className="flex items-center gap-2">
                <Skeleton className="size-5 rounded-md" />
                <div>
                  <Skeleton className="mb-1 h-4 w-24" />
                  <Skeleton className="h-3 w-32" />
                </div>
              </div>
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
            <div className="space-y-2">
              {[1, 2, 3].map((j) => (
                <Skeleton key={j} className="h-3 w-full" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
