"use client";

import { memo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { TableCell, TableRow } from "@/components/ui/table";
import { StatusSelect } from "@/components/leads/lead-status-select";
import { customerTag, formatDateTime, formatInr, type Lead } from "@/lib/leads";

type Props = {
  lead: Lead;
  canUpdate: boolean;
  /** This row's status change is in flight. */
  pending: boolean;
  /** Must be stable (useCallback), or every row re-renders on every dashboard render. */
  onStatusChange: (id: string, next: string) => void;
};

/** One leads-table row. Memoised: up to 1000 rows, each with its own status dropdown. */
export const LeadRow = memo(function LeadRow({ lead, canUpdate, pending, onStatusChange }: Props) {
  // Standup 2026-10-15: a lead opens as a full page, not a side panel.
  const router = useRouter();
  const amount = lead.loanAmount ?? lead.offerAmount;

  return (
    <TableRow onClick={() => router.push(`/dashboard/leads/${lead.id}`)} className="cursor-pointer">
      <TableCell className="whitespace-nowrap text-on-surface">
        <Link
          href={`/dashboard/leads/${lead.id}`}
          onClick={(e) => e.stopPropagation()}
          className="underline-offset-4 hover:underline focus-visible:outline-none focus-visible:underline"
        >
          {lead.name}
        </Link>
        <Badge
          // Amber, not grey: a duplicate is worth a look before anyone pays a reward twice.
          variant={lead.isNewCustomer ? "success" : "pending"}
          dot={!lead.isNewCustomer}
          className="ml-2 align-middle"
          data-customer-tag
        >
          {customerTag(lead)}
        </Badge>
      </TableCell>
      <TableCell className="font-semibold tabular-nums text-on-surface-variant">{lead.mobile}</TableCell>
      <TableCell className="font-semibold tabular-nums text-on-surface-variant">{lead.pinCode}</TableCell>
      <TableCell className="text-right tabular-nums">{amount !== null ? formatInr(amount) : "—"}</TableCell>
      <TableCell className="whitespace-nowrap">
        {lead.partner?.orgName ??
          (lead.source === "AARTHIKLABS" ? "ONDC" : <span className="text-on-surface-variant">—</span>)}
      </TableCell>
      <TableCell
        onClick={(e) => e.stopPropagation()}
        title={lead.lmsUpdatedAt ? `Updated by the LMS on ${formatDateTime(lead.lmsUpdatedAt)}` : undefined}
      >
        <StatusSelect
          value={lead.status}
          onChange={(value) => onStatusChange(lead.id, value)}
          disabled={!canUpdate || pending}
          leadName={lead.name}
          className="h-8 w-44 gap-1.5"
        >
          {/* The LMS mark sits inside the pill, beside the arrow, so the cell stays one line. */}
          {lead.lmsUpdatedAt && (
            <span className="ml-auto rounded-full bg-white/70 px-1.5 text-xs font-bold leading-4 tracking-wide" data-lms-tag>
              LMS
            </span>
          )}
        </StatusSelect>
      </TableCell>
      <TableCell className="whitespace-nowrap font-semibold tabular-nums text-on-surface-variant">
        {formatDateTime(lead.createdAt)}
      </TableCell>
    </TableRow>
  );
});
