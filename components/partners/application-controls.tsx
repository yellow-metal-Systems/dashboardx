"use client";

import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { approveApplicationAction, rejectApplicationAction, type ApplicationFormState } from "@/lib/partners/actions";
import { formatDateTime } from "@/lib/leads";
import { CopyField } from "./copy-field";

const INITIAL: ApplicationFormState = { error: null };

type PendingRow = { id: string; name: string; mobile: string; town: string; createdAt: string };

function Pending({ idle, busy, variant }: { idle: string; busy: string; variant: "dark" | "destructive" }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" variant={variant} disabled={pending}>
      {pending ? busy : idle}
    </Button>
  );
}

/** Reject asks for a reason first; the server requires one. On success the row drops out of the list. */
function RejectApplication({ applicationId, name }: { applicationId: string; name: string }) {
  const [state, reject] = useFormState(rejectApplicationAction, INITIAL);
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <Button type="button" size="sm" variant="outline" onClick={() => setOpen(true)}>
        Reject
      </Button>
    );
  }
  return (
    <form action={reject} className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-2">
        <input type="hidden" name="applicationId" value={applicationId} />
        <Input name="reason" aria-label={`Reason for rejecting ${name}`} placeholder="Reason" required autoFocus className="h-8 w-44" />
        <Pending idle="Reject" busy="Rejecting…" variant="destructive" />
        <Button type="button" size="sm" variant="outline" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
      {state.error && <p role="alert" className="text-xs text-error">{state.error}</p>}
    </form>
  );
}

/**
 * The pending queue. Approving revalidates the page, which drops the approved row,
 * so the approve result (the one-time invite link) lives here, above the rows,
 * where it survives that re-render.
 */
export function PendingApplications({ rows }: { rows: PendingRow[] }) {
  const [approved, approve] = useFormState(approveApplicationAction, INITIAL);

  return (
    <div className="flex flex-col gap-4">
      {approved.inviteUrl && (
        <div className="flex flex-col gap-2 rounded-lg bg-success-soft p-3" role="status">
          <span className="text-sm font-bold text-on-success-soft">
            Approved. Send this link to {approved.inviteFor} on WhatsApp or SMS. It works once and expires in 7 days.
          </span>
          <CopyField value={approved.inviteUrl} label={`Invite link for ${approved.inviteFor}`} testId="invite-link" />
        </div>
      )}
      {approved.error && <p role="alert" className="text-sm font-medium text-error">{approved.error}</p>}

      {rows.length === 0 ? (
        <p className="py-10 text-center text-sm text-on-surface-variant">
          No applications waiting. New partners apply on LeadBridge&apos;s /join page.
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow className="[&>th]:whitespace-nowrap">
              <TableHead>Applicant</TableHead>
              <TableHead>Town</TableHead>
              <TableHead>Applied</TableHead>
              <TableHead className="text-right" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((a) => (
              <TableRow key={a.id}>
                <TableCell className="font-medium text-on-surface">
                  {a.name}
                  <span className="block text-xs font-normal text-on-surface-variant">{a.mobile}</span>
                </TableCell>
                <TableCell>{a.town}</TableCell>
                <TableCell className="whitespace-nowrap">{formatDateTime(a.createdAt)}</TableCell>
                <TableCell>
                  <div className="flex items-start justify-end gap-2">
                    <form action={approve}>
                      <input type="hidden" name="applicationId" value={a.id} />
                      <Pending idle="Approve" busy="Approving…" variant="dark" />
                    </form>
                    <RejectApplication applicationId={a.id} name={a.name} />
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
