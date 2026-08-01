import { Skeleton } from "@/components/projekty/ui/skeleton";

export default function MyCardsLoading() {
  return (
    <main className="space-y-4">
      <Skeleton className="h-7 w-40" />
      <ul className="space-y-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <li key={i}>
            <Skeleton className="h-14 rounded-lg" />
          </li>
        ))}
      </ul>
    </main>
  );
}
