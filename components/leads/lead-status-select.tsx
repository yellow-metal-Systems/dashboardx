"use client";

import { useState } from "react";

import { updateLeadStatus } from "@/app/dashboard/actions";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { LEAD_STATUSES, STATUS_BADGE_CLASSES, type LeadStatus } from "@/lib/leads";

type Props = {
  leadId: string;
  leadName: string;
  status: LeadStatus;
  className?: string;
};

export function LeadStatusSelect({ leadId, leadName, status, className }: Props) {
  const [value, setValue] = useState<LeadStatus>(status);
  const [error, setError] = useState<string | null>(null);

  function change(next: LeadStatus) {
    const previous = value;
    setValue(next);
    setError(null);
    updateLeadStatus(leadId, next).catch(() => {
      setValue(previous);
      setError("Could not save the status change. Please try again.");
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <Select value={value} onValueChange={(v) => change(v as LeadStatus)}>
        <SelectTrigger
          aria-label={`Status for ${leadName}`}
          className={cn("h-9 border-transparent", STATUS_BADGE_CLASSES[value], className)}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {LEAD_STATUSES.map((s) => (
            <SelectItem key={s} value={s}>
              {s}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {error && (
        <p role="alert" className="text-xs text-error">
          {error}
        </p>
      )}
    </div>
  );
}
