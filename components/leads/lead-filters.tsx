"use client";

import { useState } from "react";
import { ChevronDown, X } from "lucide-react";

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
import {
  ACCEPTANCE_LABELS,
  ACCEPTANCE_STATES,
  BRANCH_MANAGER_LABELS,
  BRANCH_MANAGER_STATUSES,
  LEAD_SOURCES,
  LEAD_STATUSES,
  SOURCE_LABELS,
  type LeadPartner,
} from "@/lib/leads";
import {
  EMPTY_FILTERS,
  countActiveFilters,
  type LeadFilters as Filters,
} from "@/lib/lead-filters";

type Props = {
  filters: Filters;
  onChange: (next: Filters) => void;
  partners: LeadPartner[];
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

export function LeadFilters({ filters, onChange, partners }: Props) {
  const [expanded, setExpanded] = useState(false);
  const active = countActiveFilters(filters);

  function set<K extends keyof Filters>(key: K, value: Filters[K]) {
    onChange({ ...filters, [key]: value });
  }

  return (
    <div className="flex flex-col gap-3 rounded-md border border-outline-variant bg-surface-container-low p-3">
      <div className="flex flex-col gap-3 md:flex-row md:flex-wrap md:items-end">
        <span className="hidden self-center pr-1 text-xs font-medium text-on-surface-variant md:inline">
          Filter
        </span>
        <FilterField id="f-pincode" label="Pincode">
          <Input
            id="f-pincode"
            placeholder="e.g. 560011"
            inputMode="numeric"
            value={filters.pinCode}
            onChange={(e) => set("pinCode", e.target.value)}
            className="h-8 md:w-32"
          />
        </FilterField>
        <FilterField id="f-min" label="Min amount">
          <Input
            id="f-min"
            placeholder="₹0"
            inputMode="numeric"
            value={filters.minAmount}
            onChange={(e) => set("minAmount", e.target.value)}
            className="h-8 md:w-28"
          />
        </FilterField>
        <FilterField id="f-max" label="Max amount">
          <Input
            id="f-max"
            placeholder="No limit"
            inputMode="numeric"
            value={filters.maxAmount}
            onChange={(e) => set("maxAmount", e.target.value)}
            className="h-8 md:w-28"
          />
        </FilterField>
        <FilterField id="f-status" label="Status">
          <Select
            value={filters.status}
            onValueChange={(v) => set("status", v as Filters["status"])}
          >
            <SelectTrigger id="f-status" className="h-8 md:w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {LEAD_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FilterField>
        <FilterField id="f-partner" label="Partner">
          <Select
            value={filters.partnerId}
            onValueChange={(v) => set("partnerId", v)}
          >
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

        <div className="flex items-center gap-2 md:ml-auto">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-expanded={expanded}
            aria-controls="more-filters"
            onClick={() => setExpanded((v) => !v)}
          >
            More filters
            <ChevronDown
              className={cn(
                "ml-1 h-4 w-4 transition-transform",
                expanded && "rotate-180"
              )}
            />
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
          <FilterField id="f-source" label="Source">
            <Select
              value={filters.source}
              onValueChange={(v) => set("source", v as Filters["source"])}
            >
              <SelectTrigger id="f-source" className="h-8 md:w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All sources</SelectItem>
                {LEAD_SOURCES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {SOURCE_LABELS[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FilterField>
          <FilterField id="f-duplicate" label="Duplicates">
            <Select
              value={filters.duplicate}
              onValueChange={(v) => set("duplicate", v as Filters["duplicate"])}
            >
              <SelectTrigger id="f-duplicate" className="h-8 md:w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="only">Duplicates only</SelectItem>
                <SelectItem value="none">Non-duplicates only</SelectItem>
              </SelectContent>
            </Select>
          </FilterField>
          <FilterField id="f-acceptance" label="Acceptance">
            <Select
              value={filters.acceptanceState}
              onValueChange={(v) =>
                set("acceptanceState", v as Filters["acceptanceState"])
              }
            >
              <SelectTrigger id="f-acceptance" className="h-8 md:w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Any</SelectItem>
                {ACCEPTANCE_STATES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {ACCEPTANCE_LABELS[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FilterField>
          <FilterField id="f-bm" label="Branch manager">
            <Select
              value={filters.branchManagerStatus}
              onValueChange={(v) =>
                set("branchManagerStatus", v as Filters["branchManagerStatus"])
              }
            >
              <SelectTrigger id="f-bm" className="h-8 md:w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Any</SelectItem>
                {BRANCH_MANAGER_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {BRANCH_MANAGER_LABELS[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FilterField>
          <FilterField id="f-from" label="Created from">
            <Input
              id="f-from"
              type="date"
              value={filters.createdFrom}
              onChange={(e) => set("createdFrom", e.target.value)}
              className="h-8 md:w-40"
            />
          </FilterField>
          <FilterField id="f-to" label="Created to">
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
