import { TrendingDown, TrendingUp } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import { LEAD_STATUSES, type LeadStatus } from "@/lib/leads";
import { getOverviewStats } from "@/lib/leads-repo";

export const dynamic = "force-dynamic";

const STATUS_BAR_CLASSES: Record<LeadStatus, string> = {
  New: "bg-grey-solid",
  Contacted: "bg-grey-solid",
  Converted: "bg-success-solid",
  Rejected: "bg-error-solid",
};

function pct(part: number, whole: number): number {
  return whole === 0 ? 0 : Math.round((part / whole) * 100);
}

function StatTile({
  label,
  value,
  suffix,
  note,
}: {
  label: string;
  value: number;
  suffix?: string;
  note: React.ReactNode;
}) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-1 p-4 md:p-6">
        <p className="text-xs text-on-surface-variant">{label}</p>
        <p className="text-heading-xl tabular-nums text-on-surface">
          {value}
          {suffix}
        </p>
        <p className="text-xs text-on-surface-variant">{note}</p>
      </CardContent>
    </Card>
  );
}

export default async function OverviewPage() {
  const s = await getOverviewStats();
  const trend =
    s.prior30Days === 0 ? null : pct(s.last30Days - s.prior30Days, s.prior30Days);

  return (
    <div className="flex flex-1 flex-col gap-6 p-6 md:p-8">
      <div className="flex items-center gap-2">
        <SidebarTrigger />
      </div>

      <div>
        <h1 className="text-heading-lg text-on-surface">Overview</h1>
        <p className="mt-1 text-sm text-on-surface-variant">Last 30 days</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Total leads"
          value={s.totalLeads}
          note={
            trend === null ? (
              `${s.last30Days} in the last 30 days`
            ) : (
              <span
                className={cn(
                  "inline-flex items-center gap-1 font-medium",
                  trend >= 0 ? "text-success" : "text-error"
                )}
              >
                {trend >= 0 ? (
                  <TrendingUp className="h-3.5 w-3.5" aria-hidden="true" />
                ) : (
                  <TrendingDown className="h-3.5 w-3.5" aria-hidden="true" />
                )}
                {trend >= 0 ? "Up" : "Down"} {Math.abs(trend)}% vs prior 30 days
              </span>
            )
          }
        />
        <StatTile
          label="New today"
          value={s.newToday}
          note={`Across ${s.activePartners} active partner${s.activePartners === 1 ? "" : "s"}`}
        />
        <StatTile
          label="Duplicate rate"
          value={pct(s.duplicates, s.totalLeads)}
          suffix="%"
          note={`${s.duplicates} of ${s.totalLeads} leads`}
        />
        <StatTile
          label="Conversion rate"
          value={pct(s.converted, s.totalLeads)}
          suffix="%"
          note={`${s.converted} converted`}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <Card>
          <CardContent className="flex flex-col gap-4 pt-6 md:pt-9">
            <h2 className="text-sm font-semibold text-on-surface">Leads by status</h2>
            <ul className="flex flex-col gap-4">
              {LEAD_STATUSES.map((status) => {
                const count = s.byStatus[status];
                const share = pct(count, s.totalLeads);
                return (
                  <li key={status} className="flex flex-col gap-1.5">
                    <div className="flex items-baseline justify-between text-sm">
                      <span className="text-on-surface">{status}</span>
                      <span className="text-on-surface-variant">
                        <span className="tabular-nums">{count}</span>
                        <span className="sr-only"> leads, {share}% of total</span>
                      </span>
                    </div>
                    <div
                      aria-hidden="true"
                      className="h-1.5 w-full overflow-hidden rounded-full bg-surface-container-high"
                    >
                      <div
                        className={cn("h-full rounded-full", STATUS_BAR_CLASSES[status])}
                        style={{ width: `${share}%` }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex flex-col gap-4 pt-6 md:pt-9">
            <h2 className="text-sm font-semibold text-on-surface">
              Top partners, last 30 days
            </h2>
            {s.topPartners.length === 0 ? (
              <p className="text-sm text-on-surface-variant">
                No partner leads in the last 30 days.
              </p>
            ) : (
              <ol className="flex flex-col gap-3">
                {s.topPartners.map((p) => (
                  <li key={p.id} className="flex items-center justify-between text-sm">
                    <span className="text-on-surface">{p.orgName}</span>
                    <span className="font-semibold tabular-nums text-on-surface">
                      {p.count}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
