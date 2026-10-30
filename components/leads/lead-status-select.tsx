"use client";

import { useState, useTransition, type ReactNode } from "react";
import { ArrowRightLeft } from "lucide-react";

import { updateLeadStatus } from "@/app/dashboard/actions";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  LEAD_STATUSES,
  isTerminalStatus,
  parseLeadStatus,
  statusBadgeClass,
  statusLabel,
  type LeadStatus,
} from "@/lib/leads";
import { DisbursementDialog, type DisbursementInput } from "@/components/leads/disbursement-dialog";

/**
 * The status pill with its dropdown, shared by the leads table and the lead page.
 * A final status (Disbursed, Rejected) is always locked.
 */
export function StatusSelect({
  value,
  onChange,
  disabled,
  leadName,
  className,
  children,
  triggerLabel,
}: {
  value: string;
  onChange: (next: string) => void;
  disabled: boolean;
  leadName: string;
  className?: string;
  /** Extra marks inside the pill, before the arrow. */
  children?: ReactNode;
  /** Shown on the trigger instead of the current status (the lead page's "Change status" button). */
  triggerLabel?: ReactNode;
}) {
  const known = parseLeadStatus(value);
  const locked = known !== null && isTerminalStatus(known);
  return (
    <Select value={value} onValueChange={onChange} disabled={disabled || locked}>
      <SelectTrigger
        aria-label={`Status for ${leadName}`}
        // "!" because tailwind-merge does not know the custom shadow-* names, and a
        // final (disabled) status should read at full strength, not faded.
        className={cn("!rounded-full border-transparent !shadow-none disabled:opacity-100", statusBadgeClass(value), className)}
      >
        {triggerLabel ?? <SelectValue>{statusLabel(value)}</SelectValue>}
        {children}
      </SelectTrigger>
      <SelectContent>
        {LEAD_STATUSES.map((s) => (
          <SelectItem key={s} value={s}>
            {statusLabel(s)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

type Props = {
  leadId: string;
  leadName: string;
  status: string;
  isAarthik: boolean;
  /** False for read-only roles (customer support): the status shows but can't be changed. */
  canUpdate: boolean;
  className?: string;
  /** The lead page: a dark "Change status" button; the current status is the tag by the name. */
  asButton?: boolean;
};

export function LeadStatusSelect({ leadId, leadName, status, isAarthik, canUpdate, className, asButton }: Props) {
  const [value, setValue] = useState<string>(status);
  const [error, setError] = useState<string | null>(null);
  const [askingDisbursement, setAskingDisbursement] = useState(false);
  // Replaces the previous bare .catch(): the control is now disabled while the
  // change is in flight, so a slow round trip cannot be double-submitted or
  // interleaved with a second change.
  const [isPending, startTransition] = useTransition();

  const known = parseLeadStatus(value);
  const locked = known !== null && isTerminalStatus(known);

  function commit(next: LeadStatus, disbursement?: DisbursementInput) {
    const previous = value;
    setValue(next);
    setError(null);

    startTransition(async () => {
      try {
        const result = await updateLeadStatus(leadId, next, disbursement);
        if (!result.ok) {
          setValue(previous);
          setError(result.error);
        }
      } catch {
        setValue(previous);
        setError("Could not save the status change. Please try again.");
      }
    });
  }

  function change(next: string) {
    const parsed = parseLeadStatus(next);
    if (!parsed) return;

    // DISBURSED carries real money figures into the AarthikLabs webhook, so
    // collect them rather than sending nulls.
    if (parsed === "DISBURSED") {
      setAskingDisbursement(true);
      return;
    }
    commit(parsed);
  }

  return (
    <div className="flex flex-col gap-2">
      <StatusSelect
        value={value}
        onChange={change}
        disabled={!canUpdate || isPending}
        leadName={leadName}
        className={cn(
          "h-9",
          // The app's dark button (Button variant="dark"), over the status colours.
          asButton &&
            "!rounded-lg !border-transparent bg-gradient-to-b from-[#2b2b29] to-[#161615] px-3 font-semibold !text-white !shadow-button hover:to-[#000000] disabled:!opacity-50",
          className
        )}
        triggerLabel={
          asButton ? (
            // A div, not a span: the trigger line-clamps direct spans, which put the icon on its own line.
            <div className="flex items-center gap-2 whitespace-nowrap">
              <ArrowRightLeft className="size-4" aria-hidden="true" /> Change status
            </div>
          ) : undefined
        }
      />

      {isPending && (
        <p role="status" className="text-xs text-on-surface-variant">
          Saving…
        </p>
      )}

      {locked && !isPending && (
        <p className="text-xs text-on-surface-variant">
          {statusLabel(value)} is final — this lead can no longer be moved.
        </p>
      )}

      {error && (
        <p role="alert" className="text-xs text-error">
          {error}
        </p>
      )}

      <DisbursementDialog
        open={askingDisbursement}
        leadName={leadName}
        isAarthik={isAarthik}
        onCancel={() => setAskingDisbursement(false)}
        onConfirm={(details) => {
          setAskingDisbursement(false);
          commit("DISBURSED", details);
        }}
      />
    </div>
  );
}
