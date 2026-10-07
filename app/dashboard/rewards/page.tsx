import Link from "next/link";

import { Card, CardContent } from "@/components/ui/card";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { ApproveReward, MarkPaid, RejectReward, RewardRulesForm } from "@/components/rewards/reward-controls";
import { requireStaff } from "@/lib/auth/session";
import { formatDate, formatInr } from "@/lib/leads";
import { REWARD_STATUSES, currentRewardRules, listRewardsForStaff, payoutDateFor, type RewardState } from "@/lib/partners/rewards";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const LABEL: Record<RewardState, string> = { PENDING: "To approve", APPROVED: "To pay", PAID: "Paid", REJECTED: "Rejected" };

const crore = (n: number) =>
  n >= 10_000_000 ? `₹${(n / 10_000_000).toLocaleString("en-IN", { maximumFractionDigits: 2 })} crore` : formatInr(n);
const monthName = (d: Date) => new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric", timeZone: "UTC" }).format(d);

export default async function RewardsPage({ searchParams }: { searchParams: { status?: string } }) {
  await requireStaff();
  const status = (REWARD_STATUSES as readonly string[]).includes(searchParams.status ?? "") ? (searchParams.status as RewardState) : "PENDING";
  const [{ rows, summary, awaiting }, rules] = await Promise.all([listRewardsForStaff(status), currentRewardRules()]);

  return (
    <div className="flex flex-1 flex-col gap-6 p-6 md:p-8">
      <div className="flex items-center gap-2">
        <SidebarTrigger />
      </div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-heading-lg text-on-surface">Rewards</h1>
          <p className="mt-1 text-sm text-on-surface-variant">Partner rewards. Approved rewards are paid on the 5th of the next month.</p>
        </div>
      </div>

      <Card>
        <CardContent className="pt-6"><RewardRulesForm current={rules} /></CardContent>
      </Card>

      {awaiting.length > 0 && (
        <Card>
          <CardContent className="flex flex-col gap-1 pt-6 text-sm">
            <b className="text-on-pending-soft">
              {awaiting.length} disbursed {awaiting.length === 1 ? "loan needs its" : "loans need their"} amount before a reward can be worked out
            </b>
            <span className="text-on-surface-variant">
              Open the lead and record the disbursed amount:{" "}
              {awaiting.map((a, i) => (
                <span key={a.leadId}>
                  {i > 0 && ", "}
                  <Link href={`/dashboard/leads/${a.leadId}`} className="text-link hover:underline">{a.name}</Link> ({a.orgName})
                </span>
              ))}
            </span>
          </CardContent>
        </Card>
      )}

      <nav aria-label="Reward status" className="flex flex-wrap gap-2">
        {REWARD_STATUSES.map((s) => (
          <Link
            key={s}
            href={`/dashboard/rewards?status=${s}`}
            aria-current={s === status ? "page" : undefined}
            className={cn(
              "inline-flex h-9 items-center rounded-full px-4 text-sm font-bold",
              s === status ? "bg-black-solid text-white" : "bg-raised text-on-surface shadow-button"
            )}
          >
            {LABEL[s]} · {summary[s].count}{summary[s].count > 0 ? ` · ${formatInr(summary[s].total)}` : ""}
          </Link>
        ))}
      </nav>

      {rows.length === 0 ? (
        <Card><CardContent className="py-10 text-center text-sm text-on-surface-variant">Nothing here.</CardContent></Card>
      ) : (
        <div className="flex flex-col gap-3">
          {rows.map((r) => {
            const d = r.partner.payoutDetails;
            return (
              <Card key={r.id} data-reward={r.lead?.id ?? `bonus-${r.partner.id}`}>
                <CardContent className="flex flex-col gap-3 pt-6">
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="flex min-w-0 flex-col">
                      <span className="text-heading-sm text-on-surface">
                        {formatInr(Number(r.amount))} ·{" "}
                        <Link href={`/dashboard/partners/${r.partner.id}`} className="hover:underline">{r.partner.orgName}</Link>
                      </span>
                      <span className="text-xs text-on-surface-variant">
                        {r.lead ? (
                          <>
                            <Link href={`/dashboard/leads/${r.lead.id}`} className="text-link hover:underline">{r.lead.name}</Link>{" "}
                            · {Number(r.percent)}% of {formatInr(Number(r.baseAmount))} · disbursed {formatDate(r.disbursedAt.toISOString())}
                          </>
                        ) : (
                          <>{monthName(r.periodMonth!)} bonus · {Number(r.percent)}% of the month&apos;s {crore(Number(r.baseAmount))}</>
                        )}
                        {r.approvedAt ? ` · approved ${formatDate(r.approvedAt.toISOString())}` : ""}
                        {status === "APPROVED" && r.approvedAt ? ` · pay on ${formatDate(payoutDateFor(r.approvedAt).toISOString())}` : ""}
                        {r.paidAt ? ` · paid ${formatDate(r.paidAt.toISOString())} · ref ${r.paymentRef}` : ""}
                        {r.tdsAmount !== null && Number(r.tdsAmount) > 0 ? ` · TDS ${formatInr(Number(r.tdsAmount))}` : ""}
                        {r.rejectedReason ? ` · ${r.rejectedReason}` : ""}
                      </span>
                    </div>
                    {status === "PENDING" && <span className="ml-auto"><ApproveReward rewardId={r.id} /></span>}
                  </div>
                  {status === "APPROVED" && (
                    <div className="flex flex-col gap-2 rounded-lg bg-surface-container-low p-3 text-sm">
                      {d ? (
                        <span className="tabular-nums">
                          Pay to <b>{d.accountHolder}</b> · A/c {d.accountNumber} · IFSC {d.ifsc} · PAN {d.pan}
                        </span>
                      ) : (
                        <span className="text-on-pending-soft">The partner hasn&apos;t added PAN and bank details yet.</span>
                      )}
                      <MarkPaid rewardId={r.id} disabled={!d} />
                    </div>
                  )}
                  {(status === "PENDING" || status === "APPROVED") && <RejectReward rewardId={r.id} />}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
