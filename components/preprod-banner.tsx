import { cn } from "@/lib/utils";

// Pre-prod runs against the live database (plan of 27 Oct 2026, §2a, B6), so
// every screen says so. Read on the server; a static page bakes in the value at
// build time, which is when Netlify sets PREPROD.
export function PreprodBanner({ className }: { className?: string }) {
  if (process.env.PREPROD?.trim() !== "true") return null;
  return (
    <div role="note" className={cn("bg-pending-soft px-4 py-1.5 text-center text-xs font-bold text-on-pending-soft", className)}>
      Pre-production on the live database: use TEST names, don&apos;t submit leads, and don&apos;t change ONDC lead statuses (they
      reach AarthikLabs).
    </div>
  );
}
