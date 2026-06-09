import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="space-y-6 p-6">
      <Skeleton className="h-8 w-40" />
      <div className="flex gap-3 overflow-x-auto pb-4">
        {Array.from({ length: 6 }).map((_, col) => (
          <div key={col} className="w-72 shrink-0 rounded-lg border border-border bg-muted/30 p-3">
            <Skeleton className="mb-3 h-5 w-24" />
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-24 w-full rounded-[var(--radius-card)]" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
