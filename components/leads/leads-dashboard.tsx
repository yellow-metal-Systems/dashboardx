"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";

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
import { cn } from "@/lib/utils";
import {
  LEAD_STATUSES,
  SOURCE_LABELS,
  STATUS_BADGE_CLASSES,
  formatDate,
  formatInr,
  leadRef,
  type Lead,
  type LeadPartner,
  type LeadStatus,
} from "@/lib/leads";
import {
  EMPTY_FILTERS,
  applyLeadFilters,
  type LeadFilters as Filters,
} from "@/lib/lead-filters";

type Props = {
  initialLeads: Lead[];
  partners: LeadPartner[];
};

export function LeadsDashboard({ initialLeads, partners }: Props) {
  const [leads, setLeads] = useState<Lead[]>(initialLeads);
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  function updateStatus(id: string, status: LeadStatus) {
    const previous = leads;
    const updatedAt = new Date().toISOString();
    setSaveError(null);
    setLeads((prev) =>
      prev.map((lead) => (lead.id === id ? { ...lead, status, updatedAt } : lead))
    );
    updateLeadStatus(id, status).catch(() => {
      setLeads(previous);
      setSaveError("Could not save the status change. Please try again.");
    });
  }

  const stats = useMemo(
    () => ({
      total: leads.length,
      new: leads.filter((l) => l.status === "New").length,
      duplicates: leads.filter((l) => l.duplicateFlag).length,
      converted: leads.filter((l) => l.status === "Converted").length,
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
          <p className="mt-1 text-sm text-on-surface-variant">
            {leads.length} total · {filteredLeads.length} shown
          </p>
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
          ["Flagged duplicates", stats.duplicates],
          ["Converted", stats.converted],
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
                  <TableHead>Source</TableHead>
                  <TableHead>Partner</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Flag</TableHead>
                  <TableHead>Submitted</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLeads.map((lead) => {
                  const amount = lead.loanAmount ?? lead.offerAmount;
                  return (
                    <TableRow
                      key={lead.id}
                      onClick={() => setSelectedId(lead.id)}
                      data-state={lead.id === selectedId ? "selected" : undefined}
                      className="cursor-pointer"
                    >
                      <TableCell className="font-mono text-xs text-on-surface-variant">
                        {leadRef(lead)}
                      </TableCell>
                      <TableCell className="font-medium text-on-surface">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedId(lead.id);
                          }}
                          className="text-left underline-offset-4 hover:underline focus-visible:outline-none focus-visible:underline"
                        >
                          {lead.name}
                        </button>
                      </TableCell>
                      <TableCell>{lead.mobile}</TableCell>
                      <TableCell>{lead.pinCode}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {amount !== null ? formatInr(amount) : "—"}
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={cn(
                            "border-transparent hover:bg-inherit",
                            lead.source === "AARTHIKLABS"
                              ? "bg-black-solid font-bold text-white"
                              : "bg-secondary-container font-extrabold text-on-secondary-container"
                          )}
                        >
                          {SOURCE_LABELS[lead.source]}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {lead.partner?.orgName ?? (
                          <span className="text-on-surface-variant">—</span>
                        )}
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Select
                          value={lead.status}
                          onValueChange={(value) =>
                            updateStatus(lead.id, value as LeadStatus)
                          }
                        >
                          <SelectTrigger
                            aria-label={`Status for ${lead.name}`}
                            className={cn(
                              "h-8 w-36 border-transparent",
                              STATUS_BADGE_CLASSES[lead.status]
                            )}
                          >
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {LEAD_STATUSES.map((status) => (
                              <SelectItem key={status} value={status}>
                                {status}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        {lead.duplicateFlag ? (
                          <Badge className="border-transparent bg-error-container font-extrabold text-on-error-container hover:bg-error-container">
                            Duplicate
                          </Badge>
                        ) : (
                          <span className="text-on-surface-variant">—</span>
                        )}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {formatDate(lead.createdAt)}
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
          if (!open) setSelectedId(null);
        }}
        onStatusChange={updateStatus}
        onSelectLead={setSelectedId}
      />
    </div>
  );
}
