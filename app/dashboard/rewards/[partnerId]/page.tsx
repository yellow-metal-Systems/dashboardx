import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ApproveReward, MarkPaid, RejectReward, RevealDetails } from "@/components/rewards/reward-controls";
import { RewardPill } from "@/components/rewards/reward-pill";
import { isAdmin, requireStaff } from "@/lib/auth/session";
import { formatDate, formatDateTime, formatInr, statusLabel } from "@/lib/leads";
import { getPartnerRewardStatement, payoutDateFor, type StatementReward } from "@/lib/partners/rewards";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const PAD = "p-5 md:p-6";
const monthName = (d: Date) => new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric", timeZone: "UTC" }).format(d);
const iso = (d: Date) => d.toISOString();

const AUDIT_LABEL: Record<string, string> = {
  APPROVED: "Approved",
  REJECTED: "Rejected",
  PAID: "Paid",
  AMOUNT_UPDATED: "Amount updated",
  RULES_CHANGED: "Rules changed",
  DETAILS_REVEALED: "Full bank details shown",
  CLAWBACK_NEEDED: "Paid, then the loan was cancelled — recovery to decide",
};

function money(r: StatementReward) {
  return r.amount ? `${formatInr(Number(r.amount))} · ${Number(r.percent)}% of ${formatInr(Number(r.baseAmount))}` : null;
}

// One partner's rewards: every lead they sent, with its reward. Admins see the
// money, the payee and the audit log, and act here; team members see statuses.
export default async function PartnerRewardsPage({ params }: { params: { partnerId: string } }) {
  const staff = await requireStaff();
  const admin = await isAdmin(staff);
  const st = await getPartnerRewardStatement(params.partnerId, admin);
  if (!st) notFound();
  const { partner, leads, bonuses, payee, audit } = st;

  const toPay = [
    ...leads.filter((l) => l.reward?.status === "APPROVED").map((l) => ({ title: l.name, r: l.reward! })),
    ...bonuses.filter((b) => b.status === "APPROVED").map((b) => ({ title: `${monthName(b.periodMonth!)} bonus`, r: b })),
  ];

  return (
    <div className="flex flex-1 flex-col gap-6 p-6 md:p-8">
      <div className="flex items-center gap-2">
        <SidebarTrigger />
        <Link href="/dashboard/rewards" className="inline-flex items-center gap-1 text-sm text-on-surface-variant hover:underline">
          <ArrowLeft className="size-4" aria-hidden="true" /> Rewards
        </Link>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-heading-lg text-on-surface">{partner.orgName}</h1>
        <Badge variant="grey">{partner.type === "ORGANISATION" ? "Organisation" : "Individual"}</Badge>
        <Link href={`/dashboard/partners/${partner.id}`} className="text-sm text-link hover:underline">Partner details</Link>
      </div>

      {admin && (
        <Card>
          <CardContent className={cn("flex flex-col gap-2 text-sm", PAD)} data-payee>
            <h2 className="text-heading-sm text-on-surface">Pays to</h2>
            {payee ? (
              <>
                <span className="tabular-nums">
                  <b>{payee.accountHolder}</b> · A/c {payee.account} · IFSC {payee.ifsc} · PAN {payee.pan}
                </span>
                <span className="flex flex-wrap items-center gap-2 text-xs text-on-surface-variant">
                  {payee.savedAt && <>Saved {formatDate(iso(payee.savedAt))}</>}
                  {payee.changedRecently && <Badge variant="pending" dot>Changed in the last 7 days — confirm with the partner before paying</Badge>}
                  {payee.nameMismatch && <Badge variant="destructive">Account name doesn&apos;t match the partner</Badge>}
                </span>
                <RevealDetails partnerId={partner.id} />
              </>
            ) : (
              <span className="text-on-pending-soft">No PAN and bank details yet — the partner adds them in the LeadBridge app.</span>
            )}
          </CardContent>
        </Card>
      )}

      {admin && toPay.length > 0 && (
        <Card>
          <CardContent className={cn("flex flex-col gap-4", PAD)} data-to-pay>
            <h2 className="text-heading-sm text-on-surface">To pay</h2>
            {toPay.map(({ title, r }) => (
              <div key={r.id} className="flex flex-col gap-2 border-t border-outline-variant pt-4 first:border-t-0 first:pt-0" data-reward={r.id}>
                <span className="text-sm">
                  <b>{title}</b> · {formatInr(Number(r.amount))}
                  {r.approvedAt ? ` · approved ${formatDate(iso(r.approvedAt))} · pay on ${formatDate(iso(payoutDateFor(r.approvedAt)))}` : ""}
                </span>
                <MarkPaid rewardId={r.id} amount={Number(r.amount)} needsConfirm={!!payee?.changedRecently} disabled={!payee} />
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className={cn("flex flex-col gap-4", PAD)}>
          <h2 className="text-heading-sm text-on-surface">Leads from {partner.orgName}</h2>
          {leads.length === 0 ? (
            <p className="text-sm text-on-surface-variant">No leads yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="[&>th]:whitespace-nowrap">
                  <TableHead>Lead</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead>Disbursed</TableHead>
                  <TableHead>Reward</TableHead>
                  {admin && <TableHead className="text-right">Action</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {leads.map((l) => (
                  <TableRow key={l.id} data-lead={l.id}>
                    <TableCell className="font-medium">
                      <Link href={`/dashboard/leads/${l.id}`} className="hover:underline">{l.name}</Link>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">{statusLabel(l.status)}</TableCell>
                    <TableCell className="whitespace-nowrap">{formatDate(iso(l.createdAt))}</TableCell>
                    <TableCell className="whitespace-nowrap tabular-nums">
                      {l.disbursementDate ? formatDate(iso(l.disbursementDate)) : "—"}
                      {admin && l.disbursementAmount ? <span className="block text-xs text-on-surface-variant">{formatInr(Number(l.disbursementAmount))}</span> : null}
                    </TableCell>
                    <TableCell>
                      {l.reward ? (
                        <span className="flex flex-col items-start gap-1">
                          <RewardPill status={l.reward.status} />
                          {admin && <span className="text-xs tabular-nums text-on-surface-variant">{money(l.reward)}</span>}
                          {l.reward.status === "REJECTED" && l.reward.rejectedReason && (
                            <span className="text-xs text-on-surface-variant">{l.reward.rejectedReason}</span>
                          )}
                        </span>
                      ) : (
                        <span className="text-on-surface-variant">—</span>
                      )}
                    </TableCell>
                    {admin && (
                      <TableCell className="text-right">
                        {l.reward?.status === "PENDING" && <ApproveReward rewardId={l.reward.id} />}
                        {(l.reward?.status === "PENDING" || l.reward?.status === "APPROVED") && <RejectReward rewardId={l.reward.id} />}
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {bonuses.length > 0 && (
        <Card>
          <CardContent className={cn("flex flex-col gap-3", PAD)}>
            <h2 className="text-heading-sm text-on-surface">Monthly bonuses</h2>
            {bonuses.map((b) => (
              <div key={b.id} className="flex flex-wrap items-center justify-between gap-3 text-sm" data-bonus={b.id}>
                <span className="flex flex-col">
                  <b>{monthName(b.periodMonth!)} bonus</b>
                  {admin && <span className="text-xs tabular-nums text-on-surface-variant">{money(b)}</span>}
                </span>
                <span className="flex items-center gap-3">
                  <RewardPill status={b.status} />
                  {admin && b.status === "PENDING" && <ApproveReward rewardId={b.id} />}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {admin && audit.length > 0 && (
        <Card>
          <CardContent className={cn("flex flex-col gap-2", PAD)} data-audit>
            <h2 className="text-heading-sm text-on-surface">Audit log</h2>
            <ul className="flex flex-col gap-1 text-xs text-on-surface-variant">
              {audit.map((a) => (
                <li key={a.id}>
                  {formatDateTime(iso(a.at))} · <b className="text-on-surface">{AUDIT_LABEL[a.action] ?? a.action}</b> · {a.actor.replace(/^staff:/, "")}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
