"use client";

import { useState } from "react";
import { ChevronDown, Search, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { LEAD_STATUSES, statusLabel, type LeadPartner } from "@/lib/leads";
import {
  EMPTY_FILTERS,
  countActiveFilters,
  type LeadFilters as Filters,
} from "@/lib/lead-filters";

type Props = {
  filters: Filters;
  onChange: (next: Filters) => void;
  partners: LeadPartner[];
  branches: { id: string; name: string }[];
};

function FilterField({
  id,
  label,
  children,
  className,
}: {
  id: string;
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <label
        htmlFor={id}
        className="text-[10px] font-semibold uppercase tracking-wider text-on-surface-variant"
      >
        {label}
      </label>
      {children}
    </div>
  );
}

// Order per the 15 Oct standup: partner, status, amount, branch, then the date range.
export function LeadFilters({ filters, onChange, partners, branches }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [searching, setSearching] = useState(false);
  const active = countActiveFilters(filters);

  function set<K extends keyof Filters>(key: K, value: Filters[K]) {
    onChange({ ...filters, [key]: value });
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg bg-surface-container-low p-3">
      <div className="flex flex-col gap-3 md:flex-row md:flex-wrap md:items-end">
        <FilterField id="f-partner" label="Partner">
          <Select value={filters.partnerId} onValueChange={(v) => set("partnerId", v)}>
            <SelectTrigger id="f-partner" className="h-8 md:w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All partners</SelectItem>
              {partners.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.orgName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FilterField>
        <FilterField id="f-status" label="Status">
          <Select value={filters.status} onValueChange={(v) => set("status", v as Filters["status"])}>
            <SelectTrigger id="f-status" className="h-8 md:w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {LEAD_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {statusLabel(s)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FilterField>
        <FilterField id="f-min" label="Amount (₹)">
          <div className="flex items-center gap-1">
            <Input
              id="f-min"
              aria-label="Minimum amount"
              placeholder="Min"
              inputMode="numeric"
              value={filters.minAmount}
              onChange={(e) => set("minAmount", e.target.value)}
              className="h-8 md:w-24"
            />
            <span aria-hidden="true" className="text-on-surface-variant">–</span>
            <Input
              aria-label="Maximum amount"
              placeholder="Max"
              inputMode="numeric"
              value={filters.maxAmount}
              onChange={(e) => set("maxAmount", e.target.value)}
              className="h-8 md:w-24"
            />
          </div>
        </FilterField>
        <FilterField id="f-branch" label="Branch">
          <Select value={filters.branchId} onValueChange={(v) => set("branchId", v)}>
            <SelectTrigger id="f-branch" className="h-8 md:w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All branches</SelectItem>
              {branches.map((b) => (
                <SelectItem key={b.id} value={b.id}>
                  {b.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FilterField>

        <div className="flex items-center gap-2 md:ml-auto">
          {searching || filters.search ? (
            <div className="relative">
              <Search
                aria-hidden="true"
                className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-on-surface-variant"
              />
              <Input
                type="search"
                autoFocus
                aria-label="Search leads by name, mobile or ID"
                placeholder="Name, mobile or ID"
                value={filters.search}
                onChange={(e) => set("search", e.target.value)}
                onBlur={() => setSearching(false)}
                className="h-8 pl-8 md:w-56"
              />
            </div>
          ) : (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              aria-label="Search leads"
              onClick={() => setSearching(true)}
            >
              <Search className="h-4 w-4" />
            </Button>
          )}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-expanded={expanded}
            aria-controls="more-filters"
            onClick={() => setExpanded((v) => !v)}
          >
            Date range
            <ChevronDown className={cn("ml-1 h-4 w-4 transition-transform", expanded && "rotate-180")} />
          </Button>
          {active > 0 && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onChange({ ...EMPTY_FILTERS, search: filters.search })}
            >
              <X className="mr-1 h-3.5 w-3.5" />
              Clear ({active})
            </Button>
          )}
        </div>
      </div>

      {expanded && (
        <div
          id="more-filters"
          className="flex flex-col gap-3 border-t border-outline-variant pt-3 md:flex-row md:flex-wrap md:items-end"
        >
          <FilterField id="f-from" label="From">
            <Input
              id="f-from"
              type="date"
              value={filters.createdFrom}
              onChange={(e) => set("createdFrom", e.target.value)}
              className="h-8 md:w-40"
            />
          </FilterField>
          <FilterField id="f-to" label="To">
            <Input
              id="f-to"
              type="date"
              value={filters.createdTo}
              onChange={(e) => set("createdTo", e.target.value)}
              className="h-8 md:w-40"
            />
          </FilterField>
        </div>
      )}
    </div>
  );
}
