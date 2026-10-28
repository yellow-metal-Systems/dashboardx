"use client";

import { useRef, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  countersignAndApproveAction,
  rejectApplicationAction,
  resendAgreementAction,
  sendAgreementAction,
  type ApplicationFormState,
} from "@/lib/partners/actions";
import { CopyField } from "./copy-field";

// The application page's controls (plan of 27 Oct 2026, B4). Each action
// revalidates the page, so the server re-renders the new status; the forms only
// show errors and one-off results.

const INITIAL: ApplicationFormState = { error: null };

/** One payout-rate input; the page passes RATE_INPUTS[template] so zod stays out of the browser bundle. */
export type RateInput = { name: string; label: string; unit: "Rs" | "%" };
export type Rates = Record<string, number | null>;

function Submit({ idle, busy, variant = "dark" }: { idle: string; busy: string; variant?: "dark" | "outline" | "destructive" }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" variant={variant} disabled={pending}>
      {pending ? busy : idle}
    </Button>
  );
}

function Result({ state }: { state: ApplicationFormState }) {
  if (state.error) return <p role="alert" className="text-sm font-medium text-error">{state.error}</p>;
  if (state.message) return <p role="status" className="text-sm text-on-surface">{state.message}</p>;
  return null;
}

function RateFields({ inputs, values }: { inputs: RateInput[]; values: Rates }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {inputs.map((r) => (
        <label key={r.name} className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-on-surface">
            {r.label} ({r.unit === "Rs" ? "₹" : "%"})
          </span>
          <Input name={r.name} inputMode="decimal" defaultValue={values[r.name] ?? ""} placeholder="Leave blank" className="tabular-nums" />
        </label>
      ))}
    </div>
  );
}

/** Pending: fill the payout rates, preview the PDF, then send the signing link. */
export function SendAgreementForm({ applicationId, inputs, defaults }: { applicationId: string; inputs: RateInput[]; defaults: Rates }) {
  const [state, send] = useFormState(sendAgreementAction, INITIAL);
  const formRef = useRef<HTMLFormElement>(null);

  // The preview route renders the rates as typed, without storing or sending anything.
  function preview() {
    const fd = new FormData(formRef.current!);
    const query = new URLSearchParams(inputs.map((r) => [r.name, String(fd.get(r.name) ?? "")]));
    window.open(`/dashboard/partners/applications/${applicationId}/agreement/preview?${query}`, "_blank", "noopener");
  }

  return (
    <form ref={formRef} action={send} className="flex flex-col gap-4">
      <input type="hidden" name="applicationId" value={applicationId} />
      <RateFields inputs={inputs} values={defaults} />
      <p className="text-xs text-on-surface-variant">A blank rate prints as a blank line on the agreement. Check the preview before sending.</p>
      <Result state={state} />
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="outline" onClick={preview}>
          Preview PDF
        </Button>
        <Submit idle="Send agreement" busy="Sending…" />
      </div>
    </form>
  );
}

/** Agreement sent: a new signing link (the old one stops working), optionally with new rates. */
export function ResendAgreementForm({ applicationId, inputs, current }: { applicationId: string; inputs: RateInput[]; current: Rates }) {
  const [state, resend] = useFormState(resendAgreementAction, INITIAL);
  const [changeRates, setChangeRates] = useState(false);

  return (
    <form action={resend} className="flex flex-col gap-3">
      <input type="hidden" name="applicationId" value={applicationId} />
      <label className="flex items-center gap-2 text-sm text-on-surface">
        <input type="checkbox" name="changeRates" checked={changeRates} onChange={(e) => setChangeRates(e.target.checked)} className="size-4 accent-black" />
        Change the payout rates
      </label>
      {changeRates && <RateFields inputs={inputs} values={current} />}
      <Result state={state} />
      <div className="flex flex-wrap items-center gap-3">
        <Submit idle="Send a new link" busy="Sending…" variant="outline" />
        <span className="text-xs text-on-surface-variant">The old link stops working.</span>
      </div>
    </form>
  );
}

/** Reject asks for a reason first; the server requires one and emails it to the applicant. */
export function RejectApplication({ applicationId, name }: { applicationId: string; name: string }) {
  const [state, reject] = useFormState(rejectApplicationAction, INITIAL);
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <Button type="button" size="sm" variant="outline" onClick={() => setOpen(true)} className="self-start">
        Reject application
      </Button>
    );
  }
  return (
    <form action={reject} className="flex flex-col gap-2">
      <input type="hidden" name="applicationId" value={applicationId} />
      <div className="flex flex-wrap items-center gap-2">
        <Input name="reason" aria-label={`Reason for rejecting ${name}`} placeholder="Reason (emailed to the applicant)" required autoFocus maxLength={300} className="h-8 w-72 max-w-full" />
        <Submit idle="Reject" busy="Rejecting…" variant="destructive" />
        <Button type="button" size="sm" variant="outline" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
      <Result state={state} />
    </form>
  );
}

/**
 * Signed: countersign for Yellow Metal and approve, which creates the partner.
 * The page renders this in the same place once approved (`done`), so the
 * one-time set-password link from the result survives the re-render.
 */
export function CountersignPanel({ applicationId, staffName, done }: { applicationId: string; staffName: string; done: boolean }) {
  const [state, approve] = useFormState(countersignAndApproveAction, INITIAL);

  if (state.inviteUrl) {
    return (
      <div className="flex flex-col gap-2 rounded-lg bg-success-soft p-3" role="status">
        <span className="text-sm font-bold text-on-success-soft">{state.message}</span>
        <span className="text-sm text-on-success-soft">If the email doesn&apos;t arrive, send {state.inviteFor} this link on WhatsApp or SMS. It works once.</span>
        <CopyField value={state.inviteUrl} label={`Set-password link for ${state.inviteFor}`} testId="invite-link" />
      </div>
    );
  }
  if (done) return null;

  return (
    <form action={approve} className="flex flex-col gap-3">
      <input type="hidden" name="applicationId" value={applicationId} />
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-on-surface">Your designation (printed under your signature)</span>
        <Input name="designation" placeholder="Director" maxLength={100} className="max-w-xs" />
      </label>
      <label className="flex items-start gap-2 text-sm text-on-surface">
        <input type="checkbox" name="confirmed" required className="mt-0.5 size-4 shrink-0 accent-black" />
        <span>
          I countersign this agreement for Yellow Metal as <b>{staffName}</b>. This creates the partner and emails them the signed copy
          and a set-password link.
        </span>
      </label>
      <Result state={state} />
      <div>
        <Submit idle="Countersign and approve" busy="Countersigning…" />
      </div>
    </form>
  );
}
