import { Skeleton } from "@/components/ui/skeleton";

export default function ModulesSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="border-border/60 bg-card/70 supports-[backdrop-filter]:bg-card/50 rounded-xl border p-4 shadow-sm backdrop-blur"
        >
          <div className="flex items-start gap-3">
            <Skeleton className="h-10 w-10 rounded-md" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-24" />
            </div>
          </div>
          <div className="mt-3 space-y-2">
            <Skeleton className="h-3 w-3/4" />
            <Skeleton className="h-3 w-2/4" />
          </div>
        </div>
      ))}
    </div>
  );
}
