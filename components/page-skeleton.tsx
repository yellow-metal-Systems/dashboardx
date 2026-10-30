import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/** Loading shape for a plain page: sidebar button, title and subtitle, then cards of rows. */
export function PageSkeleton({ cards = 1, rows = 5 }: { cards?: number; rows?: number }) {
  return (
    <div className="flex flex-1 flex-col gap-6 p-6 md:p-8">
      <Skeleton className="h-7 w-7 rounded-full" />

      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-4 w-40" />
      </div>

      {Array.from({ length: cards }).map((_, c) => (
        <Card key={c}>
          <CardContent className="flex flex-col gap-3 pt-6 md:pt-9">
            {Array.from({ length: rows }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
