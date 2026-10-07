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

// Buttons that sit beside an input use size "lg" (h-10), the same height as an
// input on desktop, so the row lines up.
function Pending({
  idle,
  busy,
  variant = "outline",
  size = "sm",
}: {
  idle: string;
  busy: string;
  variant?: "outline" | "dark" | "destructive";
  size?: "sm" | "lg";
}) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size={size} variant={variant} disabled={pending}>
      {pending ? busy : idle}
    </Button>
  );
}

const Err = ({ state }: { state: RewardFormState }) =>
  state.error ? <p role="alert" className="text-xs text-error">{state.error}</p> : null;

export function ApproveReward({ rewardId }: { rewardId: string }) {
  const [state, action] = useFormState<RewardFormState, FormData>(approveRewardAction, { error: null });
  return (
    <form action={action} className="flex flex-col items-end gap-1">
      <input type="hidden" name="rewardId" value={rewardId} />
      <Pending idle="Approve" busy="Approving…" variant="dark" size="lg" />
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

export function MarkPaid({ rewardId, disabled }: { rewardId: string; disabled: boolean }) {
  const [state, action] = useFormState<RewardFormState, FormData>(markRewardPaidAction, { error: null });
  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="rewardId" value={rewardId} />
      <Input name="paymentRef" placeholder="UTR / payment reference" aria-label="Payment reference" className="w-full sm:w-60" disabled={disabled} />
      <Input name="tds" placeholder="TDS ₹ (0)" inputMode="decimal" aria-label="TDS" className="w-full sm:w-28" disabled={disabled} />
      {disabled ? (
        <span className="text-xs text-on-surface-variant">Waiting for PAN and bank details</span>
      ) : (
        <Pending idle="Mark paid" busy="Saving…" variant="dark" size="lg" />
      )}
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

export function RewardRulesForm({ current }: { current: { basePercent: number; bonusPercent: number; bonusThreshold: number } }) {
  const [state, action] = useFormState<RewardFormState, FormData>(setRewardRulesAction, { error: null });
  const key = `${current.basePercent}-${current.bonusPercent}-${current.bonusThreshold}`;
  return (
    <form action={action} key={key} className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between lg:gap-10">
      <div className="flex max-w-xl flex-col gap-1">
        <h2 className="text-heading-sm text-on-surface">Reward rules</h2>
        <p className="text-sm text-on-surface-variant">
          A share of each disbursed loan, plus a bonus on the whole month when a partner goes above the threshold.
        </p>
        <p className="text-xs text-on-surface-variant">Applies to loans disbursed from now on.</p>
      </div>
      <div className="flex shrink-0 flex-col gap-2 lg:items-end">
        <div className="flex flex-wrap items-end gap-4">
          <RuleField label="Per loan" unit="%">
            <Input name="basePercent" defaultValue={current.basePercent} inputMode="decimal" aria-label="Reward percent" className="w-20" />
          </RuleField>
          <RuleField label="Monthly bonus" unit="%">
            <Input name="bonusPercent" defaultValue={current.bonusPercent} inputMode="decimal" aria-label="Monthly bonus percent" className="w-20" />
          </RuleField>
          <RuleField label="Bonus above (₹)" unit="crore">
            <Input name="bonusThresholdCrore" defaultValue={current.bonusThreshold / 10_000_000} inputMode="decimal" aria-label="Monthly bonus threshold in crore" className="w-20" />
          </RuleField>
          <Pending idle="Save" busy="Saving…" size="lg" />
        </div>
        <Err state={state} />
        {state.ok && <span className="text-xs font-bold text-on-success-soft">Saved.</span>}
      </div>
    </form>
  );
}
