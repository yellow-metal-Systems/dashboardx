import { Badge } from "@/components/ui/badge";
import type { RewardState } from "@/lib/partners/rewards";

export const REWARD_LABEL: Record<RewardState, string> = {
  PENDING: "To approve",
  APPROVED: "To pay",
  PAID: "Paid",
  REJECTED: "Rejected",
};

const VARIANT = { PENDING: "grey", APPROVED: "pending", PAID: "success", REJECTED: "destructive" } as const;

/** A reward's state, without any amount — safe to show every staff member. */
export function RewardPill({ status }: { status: RewardState }) {
  return (
    <Badge variant={VARIANT[status]} dot={status === "APPROVED"}>
      {REWARD_LABEL[status]}
    </Badge>
  );
}
