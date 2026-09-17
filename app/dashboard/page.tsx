"use client";

import { useMemo, useState } from "react";

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
import {
  EXAMPLE_LEADS,
  LEAD_STATUSES,
  STATUS_BADGE_CLASSES,
  formatInr,
  type Lead,
  type LeadStatus,
} from "@/lib/leads";

type StatusFilter = "All" | LeadStatus;

export default function DashboardPage() {
  const [leads, setLeads] = useState<Lead[]>(EXAMPLE_LEADS);
  const [pincodeFilter, setPincodeFilter] = useState("");
  const [minAmountFilter, setMinAmountFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("All");

  function updateStatus(id: string, status: LeadStatus) {
    setLeads((prev) =>
      prev.map((lead) => (lead.id === id ? { ...lead, status } : lead))
    );
  }

  const stats = useMemo(
    () => ({
      total: leads.length,
      new: leads.filter((l) => l.status === "New").length,
      duplicates: leads.filter((l) => l.duplicate).length,
      converted: leads.filter((l) => l.status === "Converted").length,
    }),
    [leads]
  );

  const filteredLeads = useMemo(() => {
    const minAmount = Number(minAmountFilter);
    const hasMinAmount = minAmountFilter.trim() !== "" && !Number.isNaN(minAmount);

    return leads.filter((lead) => {
      if (pincodeFilter.trim() && !lead.pincode.includes(pincodeFilter.trim())) {
        return false;
      }
      if (hasMinAmount && lead.loanAmount < minAmount) {
        return false;
      }
      if (statusFilter !== "All" && lead.status !== statusFilter) {
        return false;
      }
      return true;
    });
  }, [leads, pincodeFilter, minAmountFilter, statusFilter]);

  return (
    <div className="flex flex-1 flex-col gap-6 p-6 md:p-8">
      <div className="flex items-center gap-2">
        <SidebarTrigger />
      </div>

      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-on-surface-variant">
          Internal
        </p>
        <h1 className="mt-1 text-2xl font-semibold text-on-surface">
          Dashboard
        </h1>
        <p className="mt-1 text-sm text-on-surface-variant">
          Leads submitted by partner organizations, filtered and triaged by
          your team.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-on-surface-variant">
              Total leads
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold text-on-surface">
              {stats.total}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-on-surface-variant">
              New
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold text-on-surface">
              {stats.new}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-on-surface-variant">
              Flagged duplicates
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold text-on-surface">
              {stats.duplicates}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-on-surface-variant">
              Converted
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold text-on-surface">
              {stats.converted}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="flex flex-col gap-4 pt-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:flex-wrap">
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="pincode-filter"
                className="text-xs font-medium text-on-surface-variant"
              >
                Pincode
              </label>
              <Input
                id="pincode-filter"
                placeholder="e.g. 560011"
                value={pincodeFilter}
                onChange={(e) => setPincodeFilter(e.target.value)}
                className="sm:w-40"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="min-amount-filter"
                className="text-xs font-medium text-on-surface-variant"
              >
                Min loan amount
              </label>
              <Input
                id="min-amount-filter"
                inputMode="numeric"
                placeholder="e.g. 50000"
                value={minAmountFilter}
                onChange={(e) => setMinAmountFilter(e.target.value)}
                className="sm:w-40"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="status-filter"
                className="text-xs font-medium text-on-surface-variant"
              >
                Status
              </label>
              <Select
                value={statusFilter}
                onValueChange={(value) => setStatusFilter(value as StatusFilter)}
              >
                <SelectTrigger id="status-filter" className="sm:w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="All">All</SelectItem>
                  {LEAD_STATUSES.map((status) => (
                    <SelectItem key={status} value={status}>
                      {status}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <p
              role="status"
              aria-live="polite"
              className="ml-auto text-sm text-on-surface-variant"
            >
              {filteredLeads.length} of {leads.length} leads
            </p>
          </div>

          <p className="text-xs text-on-surface-variant">
            Example / demo data shown below.
          </p>

          {filteredLeads.length === 0 ? (
            <p className="py-10 text-center text-sm text-on-surface-variant">
              No leads match these filters.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer</TableHead>
                  <TableHead>Mobile</TableHead>
                  <TableHead>Pincode</TableHead>
                  <TableHead>Loan amount</TableHead>
                  <TableHead>Partner</TableHead>
                  <TableHead>Duplicate</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Submitted</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLeads.map((lead) => (
                  <TableRow key={lead.id}>
                    <TableCell className="font-medium text-on-surface">
                      {lead.customer}
                    </TableCell>
                    <TableCell>{lead.mobile}</TableCell>
                    <TableCell>{lead.pincode}</TableCell>
                    <TableCell>{formatInr(lead.loanAmount)}</TableCell>
                    <TableCell>{lead.partner}</TableCell>
                    <TableCell>
                      {lead.duplicate ? (
                        <Badge className="bg-secondary-container text-on-secondary-container hover:bg-secondary-container">
                          Duplicate
                        </Badge>
                      ) : (
                        <span className="text-on-surface-variant">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Select
                        value={lead.status}
                        onValueChange={(value) =>
                          updateStatus(lead.id, value as LeadStatus)
                        }
                      >
                        <SelectTrigger
                          aria-label={`Status for ${lead.customer}`}
                          className={`h-8 w-36 border-transparent ${STATUS_BADGE_CLASSES[lead.status]}`}
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
                    <TableCell>{lead.submitted}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
