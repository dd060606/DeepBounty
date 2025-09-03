import { Skeleton } from "@/components/ui/skeleton";

export default function AlertsSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-9 w-80" />
        <div className="flex gap-2">
          <Skeleton className="h-9 w-28" />
          <Skeleton className="h-9 w-28" />
          <Skeleton className="h-9 w-28" />
        </div>
      </div>
      <div className="rounded-lg border">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 border-b p-4 last:border-0">
            <Skeleton className="h-5 w-5 rounded" />
            <Skeleton className="h-4 w-56" />
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-6 w-20 rounded-full" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="ml-auto h-4 w-40" />
          </div>
        ))}
      </div>
    </div>
  );
}
