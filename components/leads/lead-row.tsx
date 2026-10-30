"use client";

import { memo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ExternalLink, MoreHorizontal, Phone } from "lucide-react";

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
    <TableRow
      onClick={() => router.push(`/dashboard/leads/${lead.id}`)}
      className="cursor-pointer hover:bg-[rgba(22,22,21,0.03)] [&>td]:py-1.5"
    >
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
          className="h-7 w-40 gap-1.5 text-xs"
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
      <TableCell onClick={(e) => e.stopPropagation()} className="w-10 text-right">
        <RowMenu lead={lead} />
      </TableCell>
    </TableRow>
  );
});

/**
 * The row's "…": quick actions that don't need the lead page. A native
 * <details>, so it works with the keyboard; it closes on a click outside or Esc.
 */
function RowMenu({ lead }: { lead: Lead }) {
  const ref = useRef<HTMLDetailsElement>(null);
  const [copied, setCopied] = useState("");
  const close = () => {
    if (ref.current) ref.current.open = false;
  };
  const onToggle = () => {
    const menu = ref.current;
    if (!menu?.open) return;
    // Listen only while open: up to 1000 rows must not each hold a document listener.
    const outside = (e: Event) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !menu.contains(e.target as Node)) {
        menu.open = false;
        document.removeEventListener("click", outside);
        document.removeEventListener("keydown", outside);
      }
    };
    setTimeout(() => {
      document.addEventListener("click", outside);
      document.addEventListener("keydown", outside);
    });
  };
  const copy = async (what: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(`${what} copied`);
    } catch {
      setCopied(`Could not copy the ${what.toLowerCase()}`);
    }
    close();
    setTimeout(() => setCopied(""), 2000);
  };
  const item = "flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-sm text-on-surface hover:bg-surface-container-low";
  return (
    <details ref={ref} onToggle={onToggle} className="relative inline-block">
      <summary
        aria-label={`Actions for ${lead.name}`}
        className="flex size-8 cursor-pointer list-none items-center justify-center rounded-md text-on-surface-variant hover:bg-surface-container-low [&::-webkit-details-marker]:hidden"
      >
        <MoreHorizontal className="size-4" aria-hidden="true" />
      </summary>
      <div className="absolute right-0 top-9 z-20 flex w-48 flex-col rounded-lg bg-surface-container-lowest p-1.5 shadow-e2 ring-1 ring-outline-variant">
        <Link href={`/dashboard/leads/${lead.id}`} className={item}>
          <ExternalLink className="size-4 text-on-surface-variant" aria-hidden="true" /> Open lead
        </Link>
        <button type="button" className={item} onClick={() => copy("Mobile", lead.mobile)}>
          <Phone className="size-4 text-on-surface-variant" aria-hidden="true" /> Copy mobile
        </button>
      </div>
      <span role="status" className="sr-only">
        {copied}
      </span>
    </details>
  );
}
