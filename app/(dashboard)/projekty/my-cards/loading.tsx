import { Skeleton } from "@/components/projekty/ui/skeleton";

export default function MyCardsLoading() {
  return (
    <div className="space-y-6 p-4 md:p-6">
      <Skeleton className="h-8 w-40" />
      <ul className="space-y-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <li key={i}>
            <Skeleton className="h-14 rounded-lg" />
          </li>
        ))}
      </ul>
    </div>
  );
}
