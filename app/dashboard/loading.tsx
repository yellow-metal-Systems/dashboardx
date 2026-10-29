import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

// Matches leads-dashboard.tsx's shape (header + range pills + 3 stat tiles + filter bar +
// table) so nothing visibly reflows once the real data lands. Without this,
// clicking "Leads" in the sidebar showed nothing at all until listLeads() and
// listPartners() resolved, which read as the click not having registered.
export default function Loading() {
  return (
    <div className="flex flex-1 flex-col gap-6 p-6 md:p-8">
      <Skeleton className="h-7 w-7 rounded-full" />

      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-4 w-48" />
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <Skeleton className="h-10 w-full rounded-full md:w-[34rem]" />
        <div className="grid grid-cols-3 gap-3 md:max-w-xl">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="flex flex-col gap-2 p-4 md:p-6">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-10 w-12" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <Card>
        <CardContent className="flex flex-col gap-4 pt-6 md:pt-9">
          <Skeleton className="h-16 w-full rounded-xl" />
          <div className="flex flex-col gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
