"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { RefreshCw, Search } from "lucide-react";

import { updateLeadStatus } from "@/app/dashboard/actions";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { LeadFilters } from "@/components/leads/lead-filters";
import { LeadDetailSheet } from "@/components/leads/lead-detail-sheet";
import {
  DisbursementDialog,
  type DisbursementInput,
} from "@/components/leads/disbursement-dialog";
import { cn } from "@/lib/utils";
import {
  LEAD_STATUSES,
  isTerminalStatus,
  parseLeadStatus,
  statusBadgeClass,
  statusLabel,
  formatDateTime,
  formatInr,
  submittedLabel,
  isNewLead,
  NEW_LEAD_MINUTES,
  leadRef,
  type Lead,
  type LeadPartner,
  type LeadStatus,
} from "@/lib/leads";
import { formatAge, useLiveRefresh } from "@/hooks/use-live-refresh";
import {
  EMPTY_FILTERS,
  applyLeadFilters,
  type LeadFilters as Filters,
} from "@/lib/lead-filters";

type Props = {
  initialLeads: Lead[];
  partners: LeadPartner[];
  /** LMS updates no lead could be matched to yet. */
  lmsToMatch?: number;
};

export function LeadsDashboard({ initialLeads, partners, lmsToMatch = 0 }: Props) {
  const [leads, setLeads] = useState<Lead[]>(initialLeads);
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [disbursingId, setDisbursingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  // Mirrored into a ref so the snapshot-absorbing effect below can read the
  // current value without listing it as a dependency (which would make the effect
  // re-run on every mutation and fight the optimistic update).
  const pendingRef = useRef<string | null>(null);
  pendingRef.current = pendingId;

  function openLead(id: string | null) {
    setSelectedId(id);
  }

  // Leads also arrive from AarthikLabs posting to the partner API, and nothing
  // tells this browser about those. Poll while the tab is visible, and pause
  // while a status change is in flight.
  const { lastRefreshedAt, isRefreshing, refreshNow } = useLiveRefresh({
    enabled: pendingId === null,
  });

  // Drives the "updated 40s ago" label. Purely cosmetic, so a slow tick is fine.
  const [clock, setClock] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setClock(new Date()), 10_000);
    return () => window.clearInterval(id);
  }, []);
  // Leads under 45 minutes old get the green "New" pill; it drops off by itself.
  const newCount = leads.filter((l) => isNewLead(l.createdAt, clock)).length;

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
  function applyOptimistic(id: string, status: LeadStatus) {
    const updatedAt = new Date().toISOString();
    setLeads((prev) =>
      prev.map((lead) => (lead.id === id ? { ...lead, status, updatedAt } : lead))
    );
  }

  function revertOne(id: string, status: string, updatedAt: string) {
    setLeads((prev) =>
      prev.map((lead) => (lead.id === id ? { ...lead, status, updatedAt } : lead))
    );
  }

  function commitStatus(id: string, status: LeadStatus, disbursement?: DisbursementInput) {
    const lead = leads.find((l) => l.id === id);
    if (!lead) return;
    const previousStatus = lead.status;
    const previousUpdatedAt = lead.updatedAt;

    setSaveError(null);
    setPendingId(id);
    applyOptimistic(id, status);

    startTransition(async () => {
      try {
        const result = await updateLeadStatus(id, status, disbursement);
        if (!result.ok) {
          revertOne(id, previousStatus, previousUpdatedAt);
          setSaveError(result.error);
        }
      } catch {
        revertOne(id, previousStatus, previousUpdatedAt);
        setSaveError("Could not save the status change. Please try again.");
      } finally {
        setPendingId(null);
      }
    });
  }

  function updateStatus(id: string, next: string) {
    const status = parseLeadStatus(next);
    if (!status) return;
    // DISBURSED carries money figures into the AarthikLabs webhook, so collect
    // them instead of sending nulls.
    if (status === "DISBURSED") {
      setDisbursingId(id);
      return;
    }
    commitStatus(id, status);
  }

  const stats = useMemo(
    () => ({
      total: leads.length,
      new: leads.filter((l) => l.status === "LEAD_CREATED").length,
      newCustomers: leads.filter((l) => l.isNewCustomer).length,
      disbursed: leads.filter((l) => l.status === "DISBURSED").length,
    }),
    [leads]
  );

  const filteredLeads = useMemo(
    () => applyLeadFilters(leads, filters),
    [leads, filters]
  );

  const selectedLead = leads.find((l) => l.id === selectedId) ?? null;

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
            <span>
              {leads.length} total · {filteredLeads.length} shown
            </span>
            <span aria-hidden="true">·</span>
            <span>updated {formatAge(lastRefreshedAt, clock)}</span>
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
            <span aria-live="polite" className="inline-flex">
              {newCount > 0 && (
                <Badge variant="success" dot data-new-count>
                  {newCount} new in the last {NEW_LEAD_MINUTES} min
                </Badge>
              )}
            </span>
          </div>
        </div>
        <div className="relative md:w-72">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-on-surface-variant"
          />
          <Input
            type="search"
            aria-label="Search leads by name, mobile or ID"
            placeholder="Search leads"
            value={filters.search}
            onChange={(e) => setFilters({ ...filters, search: e.target.value })}
            className="pl-9"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["Total leads", stats.total],
          ["New", stats.new],
          ["New customers", stats.newCustomers],
          ["Disbursed", stats.disbursed],
        ].map(([label, value]) => (
          <Card key={label}>
            <CardHeader className="p-4 pb-2 md:p-6 md:pb-2">
              <CardTitle className="min-h-10 text-sm font-medium text-on-surface-variant">
                {label}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0 md:p-6 md:pt-0">
              <p className="text-heading-xl text-on-surface">{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardContent className="flex flex-col gap-4 pt-6 md:pt-9">
          <LeadFilters filters={filters} onChange={setFilters} partners={partners} />

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
                  <TableHead>Lead ID</TableHead>
                  <TableHead>Consumer</TableHead>
                  <TableHead>Mobile</TableHead>
                  <TableHead>Pincode</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Partner</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>New customer</TableHead>
                  <TableHead>Submitted</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLeads.map((lead) => {
                  const amount = lead.loanAmount ?? lead.offerAmount;
                  return (
                    <TableRow
                      key={lead.id}
                      onClick={() => openLead(lead.id)}
                      data-state={lead.id === selectedId ? "selected" : undefined}
                      className="cursor-pointer"
                    >
                      <TableCell className="font-mono text-xs text-on-surface-variant">
                        {leadRef(lead)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap font-medium text-on-surface">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            openLead(lead.id);
                          }}
                          className="text-left underline-offset-4 hover:underline focus-visible:outline-none focus-visible:underline"
                        >
                          {lead.name}
                        </button>
                        {isNewLead(lead.createdAt, clock) && (
                          <Badge variant="success" dot className="ml-2 align-middle" data-new-lead>
                            New
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>{lead.mobile}</TableCell>
                      <TableCell>{lead.pinCode}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {amount !== null ? formatInr(amount) : "—"}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {lead.partner?.orgName ??
                          (lead.source === "AARTHIKLABS" ? (
                            "ONDC"
                          ) : (
                            <span className="text-on-surface-variant">—</span>
                          ))}
                      </TableCell>
                      <TableCell
                        onClick={(e) => e.stopPropagation()}
                        title={lead.lmsUpdatedAt ? `Updated by the LMS on ${formatDateTime(lead.lmsUpdatedAt)}` : undefined}
                      >
                        <Select
                          value={lead.status}
                          onValueChange={(value) => updateStatus(lead.id, value)}
                          disabled={
                            pendingId === lead.id ||
                            (parseLeadStatus(lead.status) !== null &&
                              isTerminalStatus(parseLeadStatus(lead.status)!))
                          }
                        >
                          <SelectTrigger
                            aria-label={`Status for ${lead.name}`}
                            className={cn(
                              "h-8 w-44 gap-1.5 !rounded-full border-transparent !shadow-none disabled:opacity-100",
                              statusBadgeClass(lead.status)
                            )}
                          >
                            <SelectValue>{statusLabel(lead.status)}</SelectValue>
                            {/* The LMS mark sits inside the pill, beside the arrow, so the cell stays one line. */}
                            {lead.lmsUpdatedAt && (
                              <span
                                className="ml-auto rounded-full bg-white/70 px-1.5 text-[10px] font-bold leading-4 tracking-wide"
                                data-lms-tag
                              >
                                LMS
                              </span>
                            )}
                          </SelectTrigger>
                          <SelectContent>
                            {LEAD_STATUSES.map((status) => (
                              <SelectItem key={status} value={status}>
                                {statusLabel(status)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Badge variant={lead.isNewCustomer ? "success" : "grey"}>
                          {lead.isNewCustomer ? "Yes" : "No"}
                        </Badge>
                      </TableCell>
                      <TableCell className="whitespace-nowrap" title={formatDateTime(lead.createdAt)}>
                        {submittedLabel(lead.createdAt, clock)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <LeadDetailSheet
        lead={selectedLead}
        allLeads={leads}
        onOpenChange={(open) => {
          if (!open) openLead(null);
        }}
        onStatusChange={updateStatus}
        onSelectLead={openLead}
      />

      <DisbursementDialog
        open={disbursingId !== null}
        leadName={leads.find((l) => l.id === disbursingId)?.name ?? "this lead"}
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
