import { Skeleton } from "@/components/projekty/ui/skeleton";

// Geometrie zrcadlí MyWorkView: hlavička, taby, dvě sekce s řádky.
export default function MyWorkLoading() {
  return (
    <div className="mx-auto max-w-3xl space-y-6 px-6 py-10">
      <div className="space-y-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>
      <div className="flex gap-2">
        <Skeleton className="h-9 w-32" />
        <Skeleton className="h-9 w-28" />
      </div>
      <div className="space-y-4 rounded-xl border border-border p-0">
        {Array.from({ length: 2 }).map((_, section) => (
          <div key={section}>
            <Skeleton className="h-7 w-full rounded-none" />
            <div className="space-y-px p-0">
              {Array.from({ length: 3 }).map((_, row) => (
                <Skeleton key={row} className="h-11 rounded-none" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
