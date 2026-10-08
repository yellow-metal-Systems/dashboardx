"use client";

import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  approveRewardAction,
  markRewardPaidAction,
  rejectRewardAction,
  revealPayoutDetailsAction,
  setRewardRulesAction,
  type RevealState,
  type RewardFormState,
} from "@/lib/partners/actions";
import { formatInr } from "@/lib/leads";

// Admin-only controls (the pages render them for admins only, and every action
// re-checks the role on the server). Buttons that sit beside an input use size
// "lg" (h-10), the same height as an input on desktop, so the row lines up.
function Pending({
  idle,
  busy,
  variant = "outline",
  size = "sm",
  disabled,
}: {
  idle: string;
  busy: string;
  variant?: "outline" | "dark" | "destructive";
  size?: "sm" | "lg";
  disabled?: boolean;
}) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size={size} variant={variant} disabled={pending || disabled}>
      {pending ? busy : idle}
    </Button>
  );
}

const Err = ({ state }: { state: { error: string | null } }) =>
  state.error ? <p role="alert" className="text-xs text-error">{state.error}</p> : null;

export function ApproveReward({ rewardId }: { rewardId: string }) {
  const [state, action] = useFormState<RewardFormState, FormData>(approveRewardAction, { error: null });
  return (
    <form action={action} className="flex flex-col items-end gap-1">
      <input type="hidden" name="rewardId" value={rewardId} />
      <Pending idle="Approve" busy="Approving…" variant="dark" />
      <Err state={state} />
    </form>
  );
}

export function RejectReward({ rewardId }: { rewardId: string }) {
  const [state, action] = useFormState<RewardFormState, FormData>(rejectRewardAction, { error: null });
  return (
    <details className="group text-sm">
      <summary className="inline-flex cursor-pointer list-none items-center gap-1 font-bold text-error [&::-webkit-details-marker]:hidden">
        Reject…
      </summary>
      <form action={action} className="mt-3 flex flex-wrap items-center gap-2">
        <input type="hidden" name="rewardId" value={rewardId} />
        <Input name="reason" placeholder="Reason the partner will see" aria-label="Reason" className="w-full sm:w-80" />
        <Pending idle="Reject reward" busy="Rejecting…" variant="destructive" size="lg" />
        <Err state={state} />
      </form>
    </details>
  );
}

/** Record a payment: UTR + TDS, the take-home shown before saving; a recent bank change needs a confirmation tick. */
export function MarkPaid({
  rewardId,
  amount,
  needsConfirm,
  disabled,
}: {
  rewardId: string;
  amount: number;
  needsConfirm: boolean;
  disabled: boolean;
}) {
  const [state, action] = useFormState<RewardFormState, FormData>(markRewardPaidAction, { error: null });
  const [tds, setTds] = useState("");
  const tdsNum = Number(tds.replace(/[,\s₹]/g, "")) || 0;
  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="rewardId" value={rewardId} />
      <div className="flex flex-wrap items-center gap-2">
        <Input name="paymentRef" placeholder="UTR / payment reference" aria-label="Payment reference" className="w-full sm:w-56" disabled={disabled} />
        <Input
          name="tds"
          placeholder="TDS ₹ (0)"
          inputMode="decimal"
          aria-label="TDS"
          className="w-full sm:w-28"
          disabled={disabled}
          value={tds}
          onChange={(e) => setTds(e.target.value)}
        />
        {disabled ? (
          <span className="text-xs text-on-surface-variant">Waiting for PAN and bank details</span>
        ) : (
          <>
            <span className="text-sm text-on-surface-variant" data-net>
              Pay {formatInr(Math.max(0, amount - tdsNum))}
            </span>
            <Pending idle="Mark paid" busy="Saving…" variant="dark" size="lg" />
          </>
        )}
      </div>
      {needsConfirm && !disabled && (
        <label className="flex items-center gap-2 text-xs text-on-pending-soft">
          <input type="checkbox" name="confirmedNewAccount" className="size-4 accent-black" />
          The bank details changed recently — I confirmed the new account with the partner.
        </label>
      )}
      <Err state={state} />
    </form>
  );
}

/** Full PAN and account number on request; every reveal is recorded in the audit log. */
export function RevealDetails({ partnerId }: { partnerId: string }) {
  const [state, action] = useFormState<RevealState, FormData>(revealPayoutDetailsAction, { error: null });
  if (state.details) {
    const d = state.details;
    return (
      <span className="select-all font-mono text-xs text-on-surface" data-revealed>
        {d.accountHolder} · A/c {d.accountNumber} · IFSC {d.ifsc} · PAN {d.pan}
      </span>
    );
  }
  return (
    <form action={action} className="inline-flex items-center gap-2">
      <input type="hidden" name="partnerId" value={partnerId} />
      <Pending idle="Show full details" busy="Showing…" />
      <span className="text-xs text-on-surface-variant">Logged</span>
      <Err state={state} />
    </form>
  );
}

function RuleField({ label, unit, children }: { label: string; unit: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-bold text-on-surface-variant">{label}</span>
      <span className="flex items-center gap-2">
        {children}
        <span className="text-sm text-on-surface-variant">{unit}</span>
      </span>
    </label>
  );
}

/** Rule changes show exactly what changes (old → new) and need a reason before they can be saved. */
export function RewardRulesForm({ current }: { current: { basePercent: number; bonusPercent: number; bonusThreshold: number } }) {
  const [state, action] = useFormState<RewardFormState, FormData>(setRewardRulesAction, { error: null });
  const key = `${current.basePercent}-${current.bonusPercent}-${current.bonusThreshold}`;
  const [base, setBase] = useState(String(current.basePercent));
  const [bonus, setBonus] = useState(String(current.bonusPercent));
  const [crore, setCrore] = useState(String(current.bonusThreshold / 10_000_000));
  const [reason, setReason] = useState("");
  const changes = [
    Number(base) !== current.basePercent && `Per loan ${current.basePercent}% → ${base}%`,
    Number(bonus) !== current.bonusPercent && `Monthly bonus ${current.bonusPercent}% → ${bonus}%`,
    Number(crore) * 10_000_000 !== current.bonusThreshold && `Bonus above ₹${current.bonusThreshold / 10_000_000} crore → ₹${crore} crore`,
  ].filter(Boolean) as string[];
  return (
    <form action={action} key={key} className="flex flex-col gap-4">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between lg:gap-10">
        <div className="flex max-w-xl flex-col gap-1">
          <h2 className="text-heading-sm text-on-surface">Reward rules</h2>
          <p className="text-sm text-on-surface-variant">
            A share of each disbursed loan, plus a bonus on the whole month when a partner goes above the threshold.
          </p>
          <p className="text-xs text-on-surface-variant">Applies to loans disbursed from now on.</p>
        </div>
        <div className="flex shrink-0 flex-wrap items-end gap-4">
          <RuleField label="Per loan" unit="%">
            <Input name="basePercent" value={base} onChange={(e) => setBase(e.target.value)} inputMode="decimal" aria-label="Reward percent" className="w-20" />
          </RuleField>
          <RuleField label="Monthly bonus" unit="%">
            <Input name="bonusPercent" value={bonus} onChange={(e) => setBonus(e.target.value)} inputMode="decimal" aria-label="Monthly bonus percent" className="w-20" />
          </RuleField>
          <RuleField label="Bonus above (₹)" unit="crore">
            <Input name="bonusThresholdCrore" value={crore} onChange={(e) => setCrore(e.target.value)} inputMode="decimal" aria-label="Monthly bonus threshold in crore" className="w-20" />
          </RuleField>
        </div>
      </div>
      {changes.length > 0 && (
        <div className="flex flex-col gap-2 rounded-lg bg-pending-soft p-4 text-sm text-on-pending-soft" data-rule-changes>
          <b>{changes.join(" · ")}</b>
          <div className="flex flex-wrap items-center gap-2">
            <Input name="reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why are the rules changing?" aria-label="Reason for the change" className="w-full sm:w-96" />
            <Pending idle="Save new rules" busy="Saving…" variant="dark" size="lg" disabled={reason.trim().length < 5} />
          </div>
        </div>
      )}
      <Err state={state} />
      {state.ok && <span className="text-xs font-bold text-on-success-soft">Saved.</span>}
    </form>
  );
}
