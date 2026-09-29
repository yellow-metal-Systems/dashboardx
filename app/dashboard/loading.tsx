import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

// Matches leads-dashboard.tsx's shape (header + 4 stat cards + filter bar +
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
        <Skeleton className="h-10 w-full md:w-72" />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardHeader className="p-4 pb-2 md:p-6 md:pb-2">
              <Skeleton className="h-4 w-20" />
            </CardHeader>
            <CardContent className="p-4 pt-0 md:p-6 md:pt-0">
              <Skeleton className="h-8 w-12" />
            </CardContent>
          </Card>
        ))}
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
