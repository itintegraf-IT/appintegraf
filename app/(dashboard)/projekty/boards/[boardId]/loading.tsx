import { Skeleton } from "@/components/projekty/ui/skeleton";

export default function BoardDetailLoading() {
  return (
    <div className="-m-4 flex h-[calc(100dvh-3rem)] flex-col bg-background md:-m-6">
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <Skeleton className="h-6 w-56" />
        <Skeleton className="h-8 w-24" />
      </div>
      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
        <Skeleton className="h-7 w-20" />
        <Skeleton className="h-7 w-20" />
        <Skeleton className="h-7 w-20" />
      </div>
      <div className="flex flex-1 gap-3 overflow-hidden p-4">
        {Array.from({ length: 4 }).map((_, col) => (
          <div key={col} className="flex w-[260px] shrink-0 flex-col gap-2 rounded-lg bg-muted/40 p-2">
            <Skeleton className="h-6 w-32" />
            {Array.from({ length: 3 }).map((_, row) => (
              <Skeleton key={row} className="h-20 rounded-lg" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
