"use client";

import { useFormState, useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  approveRewardAction,
  markRewardPaidAction,
  rejectRewardAction,
  setRewardRulesAction,
  type RewardFormState,
} from "@/lib/partners/actions";

function Pending({ idle, busy, variant = "outline" }: { idle: string; busy: string; variant?: "outline" | "dark" | "destructive" }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" variant={variant} disabled={pending}>
      {pending ? busy : idle}
    </Button>
  );
}

const Err = ({ state }: { state: RewardFormState }) =>
  state.error ? <p role="alert" className="text-xs text-error">{state.error}</p> : null;

export function ApproveReward({ rewardId }: { rewardId: string }) {
  const [state, action] = useFormState<RewardFormState, FormData>(approveRewardAction, { error: null });
  return (
    <form action={action} className="flex items-center gap-2">
      <input type="hidden" name="rewardId" value={rewardId} />
      <Pending idle="Approve" busy="Approving…" variant="dark" />
      <Err state={state} />
    </form>
  );
}

export function RejectReward({ rewardId }: { rewardId: string }) {
  const [state, action] = useFormState<RewardFormState, FormData>(rejectRewardAction, { error: null });
  return (
    <details className="text-sm">
      <summary className="cursor-pointer font-bold text-error">Reject</summary>
      <form action={action} className="mt-2 flex flex-wrap items-center gap-2">
        <input type="hidden" name="rewardId" value={rewardId} />
        <Input name="reason" placeholder="Reason the partner will see" aria-label="Reason" className="max-w-xs" />
        <Pending idle="Reject reward" busy="Rejecting…" variant="destructive" />
        <Err state={state} />
      </form>
    </details>
  );
}

export function MarkPaid({ rewardId, disabled }: { rewardId: string; disabled: boolean }) {
  const [state, action] = useFormState<RewardFormState, FormData>(markRewardPaidAction, { error: null });
  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="rewardId" value={rewardId} />
      <Input name="paymentRef" placeholder="UTR / payment reference" aria-label="Payment reference" className="max-w-[14rem]" disabled={disabled} />
      <Input name="tds" placeholder="TDS ₹ (0)" inputMode="decimal" aria-label="TDS" className="max-w-[7rem]" disabled={disabled} />
      {disabled ? (
        <span className="text-xs text-on-surface-variant">Waiting for PAN and bank details</span>
      ) : (
        <Pending idle="Mark paid" busy="Saving…" variant="dark" />
      )}
      <Err state={state} />
    </form>
  );
}

export function RewardRulesForm({ current }: { current: { basePercent: number; bonusPercent: number; bonusThreshold: number } }) {
  const [state, action] = useFormState<RewardFormState, FormData>(setRewardRulesAction, { error: null });
  const key = `${current.basePercent}-${current.bonusPercent}-${current.bonusThreshold}`;
  return (
    <form action={action} key={key} className="flex flex-wrap items-center gap-2 text-sm text-on-surface">
      <span>Partners earn</span>
      <Input name="basePercent" defaultValue={current.basePercent} inputMode="decimal" aria-label="Reward percent" className="w-16" />
      <span>% of each disbursed loan, plus</span>
      <Input name="bonusPercent" defaultValue={current.bonusPercent} inputMode="decimal" aria-label="Monthly bonus percent" className="w-16" />
      <span>% of the month when it is above ₹</span>
      <Input name="bonusThresholdCrore" defaultValue={current.bonusThreshold / 10_000_000} inputMode="decimal" aria-label="Monthly bonus threshold in crore" className="w-16" />
      <span>crore.</span>
      <Pending idle="Save" busy="Saving…" />
      <span className="text-xs text-on-surface-variant">Applies to loans disbursed from now on.</span>
      <Err state={state} />
      {state.ok && <span className="text-xs font-bold text-on-success-soft">Saved.</span>}
    </form>
  );
}
