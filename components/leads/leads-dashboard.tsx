"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { RefreshCw } from "lucide-react";

import { updateLeadStatus } from "@/app/dashboard/actions";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { LeadFilters } from "@/components/leads/lead-filters";
import { LeadRow } from "@/components/leads/lead-row";
import { SegmentedControl } from "@/components/segmented-control";
import { StatTile } from "@/components/stat-tile";
import {
  DisbursementDialog,
  type DisbursementInput,
} from "@/components/leads/disbursement-dialog";
import { cn } from "@/lib/utils";
import {
  parseLeadStatus,
  isNewLead,
  NEW_LEAD_MINUTES,
  type Lead,
  type LeadPartner,
  type LeadStatus,
} from "@/lib/leads";
import { useLiveRefresh } from "@/hooks/use-live-refresh";
import {
  EMPTY_FILTERS,
  TIME_RANGES,
  TIME_RANGE_LABELS,
  applyLeadFilters,
  applyTimeRange,
  leadMetrics,
  type LeadFilters as Filters,
  type TimeRange,
} from "@/lib/lead-filters";

type Props = {
  initialLeads: Lead[];
  partners: LeadPartner[];
  branches: { id: string; name: string }[];
  /** LMS updates no lead could be matched to yet. */
  lmsToMatch?: number;
  /** Customer support is read-only: the status shows but can't be changed. */
  canUpdate: boolean;
};

type Range = TimeRange | "custom";

const RANGE_OPTIONS: { value: Range; label: string }[] = [
  ...TIME_RANGES.map((r) => ({ value: r, label: TIME_RANGE_LABELS[r] })),
  { value: "custom", label: "Custom" },
];

export function LeadsDashboard({ initialLeads, partners, branches, lmsToMatch = 0, canUpdate }: Props) {
  const [leads, setLeads] = useState<Lead[]>(initialLeads);
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [range, setRange] = useState<Range>("all");
  // From/To belong to the range pills, not the filter bar: one date control, so a
  // range and a separate date filter can no longer silently empty the table together.
  const [custom, setCustom] = useState({ from: "", to: "" });
  const [saveError, setSaveError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [disbursingId, setDisbursingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  // Mirrored into a ref so the snapshot-absorbing effect below can read the
  // current value without listing it as a dependency (which would make the effect
  // re-run on every mutation and fight the optimistic update).
  const pendingRef = useRef<string | null>(null);
  pendingRef.current = pendingId;
  // Read by commitStatus, so it stays one stable function for the memoised rows.
  const leadsRef = useRef(leads);
  leadsRef.current = leads;

  // Leads also arrive from AarthikLabs posting to the partner API, and nothing
  // tells this browser about those. Poll while the tab is visible, and pause
  // while a status change is in flight.
  const { isRefreshing, refreshNow } = useLiveRefresh({
    enabled: pendingId === null,
  });

  // Absorb a newer server snapshot.
  //
  // THIS is what made a refresh necessary before: useState(initialLeads) captures
  // that array once on mount, so a re-rendered server component handed down new
  // props and the table kept showing the old list. Only a full page load rebuilt
  // the component and picked them up.
  //
  // The row currently being mutated is preserved, so a server render that lands
  // mid-flight cannot briefly flash the old status back.
  useEffect(() => {
    setLeads((prev) => {
      const pending = pendingRef.current;
      if (pending === null) return initialLeads;
      return initialLeads.map((lead) =>
        lead.id === pending ? (prev.find((p) => p.id === lead.id) ?? lead) : lead
      );
    });
  }, [initialLeads]);

  // Optimistic, but scoped to the one row. The previous version snapshotted the
  // ENTIRE leads array and restored it on failure, so a failed change also
  // discarded any concurrent edit to a different lead.
  const setOne = useCallback((id: string, status: string, updatedAt: string) => {
    setLeads((prev) =>
      prev.map((lead) => (lead.id === id ? { ...lead, status, updatedAt } : lead))
    );
  }, []);

  const commitStatus = useCallback(
    (id: string, status: LeadStatus, disbursement?: DisbursementInput) => {
      const lead = leadsRef.current.find((l) => l.id === id);
      if (!lead) return;
      const previousStatus = lead.status;
      const previousUpdatedAt = lead.updatedAt;

      setSaveError(null);
      setPendingId(id);
      setOne(id, status, new Date().toISOString());

      startTransition(async () => {
        try {
          const result = await updateLeadStatus(id, status, disbursement);
          if (!result.ok) {
            setOne(id, previousStatus, previousUpdatedAt);
            setSaveError(result.error);
          }
        } catch {
          setOne(id, previousStatus, previousUpdatedAt);
          setSaveError("Could not save the status change. Please try again.");
        } finally {
          setPendingId(null);
        }
      });
    },
    [setOne]
  );

  const updateStatus = useCallback(
    (id: string, next: string) => {
      const status = parseLeadStatus(next);
      if (!status) return;
      // DISBURSED carries money figures into the AarthikLabs webhook, so collect
      // them instead of sending nulls.
      if (status === "DISBURSED") {
        setDisbursingId(id);
        return;
      }
      commitStatus(id, status);
    },
    [commitStatus]
  );

  // The timeline narrows both the cards and the table; the filters narrow the table
  // further. A rolling window is measured when the leads change (at least every 30s
  // poll) rather than on a ticking clock, so the table does not re-render on a timer.
  const rangedLeads = useMemo(
    () =>
      range === "custom"
        ? applyLeadFilters(leads, { ...EMPTY_FILTERS, createdFrom: custom.from, createdTo: custom.to })
        : applyTimeRange(leads, range),
    [leads, range, custom]
  );
  const stats = useMemo(() => leadMetrics(rangedLeads), [rangedLeads]);

  const filteredLeads = useMemo(
    () => applyLeadFilters(rangedLeads, filters),
    [rangedLeads, filters]
  );

  return (
    <div className="flex flex-1 flex-col gap-6 p-6 md:p-8">
      <div className="flex items-center gap-2">
        <SidebarTrigger />
      </div>

      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-on-surface-variant">
            Internal
          </p>
          <h1 className="mt-1 text-heading-lg text-on-surface">Leads</h1>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-on-surface-variant">
            <span className="tabular-nums">
              {leads.length} total · {filteredLeads.length} shown
            </span>
            <button
              type="button"
              onClick={refreshNow}
              className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-sm font-medium text-on-surface-variant underline-offset-2 hover:text-on-surface hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
            >
              <RefreshCw
                aria-hidden="true"
                className={cn("h-3.5 w-3.5", isRefreshing && "motion-safe:animate-spin")}
              />
              Refresh
            </button>
            {lmsToMatch > 0 && (
              <Link href="/dashboard/leads/lms-review" className="inline-flex" data-lms-to-match>
                <Badge variant="pending" dot>
                  {lmsToMatch} LMS {lmsToMatch === 1 ? "update needs" : "updates need"} a lead
                </Badge>
              </Link>
            )}
            <NewLeadsBadge leads={leads} />
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-3 md:flex-row md:flex-wrap md:items-center">
          <SegmentedControl
            label="Time range"
            options={RANGE_OPTIONS}
            value={range}
            onChange={setRange}
            className="w-fit flex-wrap"
            itemClassName="h-8 px-3"
          />
          {range === "custom" && (
            <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-on-surface-variant">
              <label htmlFor="f-from">From</label>
              <Input
                id="f-from"
                type="date"
                value={custom.from}
                onChange={(e) => setCustom((c) => ({ ...c, from: e.target.value }))}
                className="h-8 w-40"
              />
              <label htmlFor="f-to">To</label>
              <Input
                id="f-to"
                type="date"
                value={custom.to}
                onChange={(e) => setCustom((c) => ({ ...c, to: e.target.value }))}
                className="h-8 w-40"
              />
            </div>
          )}
        </div>

        <div className="grid grid-cols-3 gap-3 md:max-w-xl">
          <StatTile label="Total leads" value={stats.total} />
          <StatTile label="New" value={stats.newCustomers} />
          <StatTile label="Disbursed" value={stats.disbursed} />
        </div>
      </div>

      <Card className="shadow-e1">
        <CardContent className="flex flex-col gap-4 pt-6 md:pt-9">
          <LeadFilters filters={filters} onChange={setFilters} partners={partners} branches={branches} />

          <p role="status" aria-live="polite" className="sr-only">
            {filteredLeads.length} of {leads.length} leads
          </p>

          {saveError && (
            <p role="alert" className="rounded bg-error-container px-3 py-2 text-sm text-on-error-container">
              {saveError}
            </p>
          )}

          <p className="text-xs text-on-surface-variant">
            Click a row for full details.
          </p>

          {filteredLeads.length === 0 ? (
            <p className="py-10 text-center text-sm text-on-surface-variant">
              {leads.length === 0
                ? "No leads yet."
                : "No leads match these filters."}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="[&>th]:whitespace-nowrap">
                  <TableHead>Consumer</TableHead>
                  <TableHead>Mobile</TableHead>
                  <TableHead>Pincode</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Partner</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Submitted</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLeads.map((lead) => (
                  <LeadRow
                    key={lead.id}
                    lead={lead}
                    canUpdate={canUpdate}
                    pending={pendingId === lead.id}
                    onStatusChange={updateStatus}
                  />
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <DisbursementDialog
        // A fresh form per lead, so one lead's figures never carry over to the next.
        key={disbursingId ?? ""}
        open={disbursingId !== null}
        leadName={leads.find((l) => l.id === disbursingId)?.name ?? "this lead"}
        isAarthik={leads.find((l) => l.id === disbursingId)?.source === "AARTHIKLABS"}
        onCancel={() => setDisbursingId(null)}
        onConfirm={(details) => {
          const id = disbursingId;
          setDisbursingId(null);
          if (id) commitStatus(id, "DISBURSED", details);
        }}
      />
    </div>
  );
}

/**
 * "N new in the last 45 min". It owns the 10-second clock, so the tick re-renders
 * only this badge, not the whole table. Leads under 45 minutes old get the green
 * "New" pill; it drops off by itself. The live region stays mounted while empty.
 */
function NewLeadsBadge({ leads }: { leads: Lead[] }) {
  const [clock, setClock] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setClock(new Date()), 10_000);
    return () => window.clearInterval(id);
  }, []);
  const newCount = leads.filter((l) => isNewLead(l.createdAt, clock)).length;

  return (
    <span aria-live="polite" className="inline-flex">
      {newCount > 0 && (
        <Badge variant="success" dot data-new-count>
          {newCount} new in the last {NEW_LEAD_MINUTES} min
        </Badge>
      )}
    </span>
  );
}
