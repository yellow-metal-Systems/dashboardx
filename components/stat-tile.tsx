import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/**
 * Headline numbers in one card, split by thin lines: the look of the Leads
 * strip. Pass the column count for wide screens (lg:grid-cols-N).
 */
export function StatStrip({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <Card className={cn("grid divide-y divide-outline-variant overflow-hidden lg:divide-x lg:divide-y-0", className)}>
      {children}
    </Card>
  );
}

/** One headline number inside a StatStrip. Overview and Rewards share it. */
export function StatTile({
  label,
  value,
  suffix,
  note,
}: {
  label: string;
  value: number | string;
  suffix?: string;
  note?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1 p-4 md:p-5">
      <p className="text-xs text-on-surface-variant">{label}</p>
      <p className="text-heading-xl tabular-nums text-on-surface">
        {value}
        {suffix}
      </p>
      {note && <p className="text-xs text-on-surface-variant">{note}</p>}
    </div>
  );
}
