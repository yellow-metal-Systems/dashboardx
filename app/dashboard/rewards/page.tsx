import Link from "next/link";
import { Search } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RewardRulesForm } from "@/components/rewards/reward-controls";
import { isAdmin, requireStaff } from "@/lib/auth/session";
import { formatDate, formatInr } from "@/lib/leads";
import { currentRewardRules, listRewardPartners, rewardRulesHistory, type PartnerRewardRow } from "@/lib/partners/rewards";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

// Even padding on every side. CardContent's default drops the top padding
// because it expects a CardHeader above it; these cards have none.
const PAD = "p-5 md:p-6";

function CountCell({ count, amount }: { count: number; amount?: number }) {
  if (count === 0) return <span className="text-on-surface-variant">—</span>;
  return (
    <span className="flex flex-col">
      <span className="tabular-nums">{count}</span>
      {amount !== undefined && <span className="text-xs tabular-nums text-on-surface-variant">{formatInr(amount)}</span>}
    </span>
  );
}

function Flags({ row }: { row: PartnerRewardRow }) {
  const f = row.flags!;
  if (!f.noPayoutDetails && !f.detailsChangedRecently && !f.nameMismatch) return <span className="text-on-surface-variant">—</span>;
  return (
    <span className="flex flex-wrap gap-1">
      {f.noPayoutDetails && <Badge variant="grey">No bank details</Badge>}
      {f.detailsChangedRecently && <Badge variant="pending" dot>Bank changed</Badge>}
      {f.nameMismatch && <Badge variant="destructive">Name mismatch</Badge>}
    </span>
  );
}

// Rewards grouped by partner. Admins see the money; team members see only how
// many rewards are where — their data never includes an amount.
export default async function RewardsPage({ searchParams }: { searchParams: { q?: string } }) {
  const staff = await requireStaff();
  const admin = await isAdmin(staff);
  const [{ rows, totals, awaiting }, rules, history] = await Promise.all([
    listRewardPartners(admin),
    admin ? currentRewardRules() : Promise.resolve(null),
    admin ? rewardRulesHistory() : Promise.resolve([]),
  ]);
  const q = (searchParams.q ?? "").trim();
  const shown = q ? rows.filter((r) => r.orgName.toLowerCase().includes(q.toLowerCase())) : rows;

  return (
    <div className="flex flex-1 flex-col gap-6 p-6 md:p-8">
      <div className="flex items-center gap-2">
        <SidebarTrigger />
      </div>
      <div>
        <h1 className="text-heading-lg text-on-surface">Rewards</h1>
        <p className="mt-1 text-sm text-on-surface-variant">
          {admin
            ? "Partner rewards, grouped by partner. Approved rewards are paid on the 5th of the next month."
            : "Each partner's rewards and where they are. Amounts are visible to admins only."}
        </p>
      </div>

      {totals && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {[
            ["To approve", totals.toApprove],
            ["To pay", totals.owed],
            ["Paid this financial year", totals.paidThisFy],
          ].map(([label, value]) => (
            <Card key={label as string}>
              <CardContent className={cn("flex flex-col gap-1", PAD)}>
                <span className="text-sm text-on-surface-variant">{label}</span>
                <span className="text-heading-lg tabular-nums text-on-surface">{formatInr(value as number)}</span>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {rules && (
        <Card>
          <CardContent className={cn("flex flex-col gap-3", PAD)}>
            <RewardRulesForm current={rules} />
            {history.length > 1 && (
              <details className="text-sm">
                <summary className="cursor-pointer font-bold text-on-surface-variant">Rule changes</summary>
                <ul className="mt-2 flex flex-col gap-1 text-xs text-on-surface-variant">
                  {history.map((h) => (
                    <li key={h.effectiveFrom.toISOString()}>
                      {formatDate(h.effectiveFrom.toISOString())}: {h.basePercent}% · {h.bonusPercent}% above ₹{h.bonusThreshold / 10_000_000} crore
                      {h.by ? ` · ${h.by.replace(/^staff:/, "")}` : ""}
                      {h.reason ? ` — ${h.reason}` : ""}
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </CardContent>
        </Card>
      )}

      {awaiting.length > 0 && (
        <Card>
          <CardContent className={cn("flex flex-col gap-1 text-sm", PAD)}>
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

      <Card>
        <CardContent className={cn("flex flex-col gap-4", PAD)}>
          <form role="search" className="relative md:w-72">
            <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-on-surface-variant" />
            <Input name="q" type="search" defaultValue={q} placeholder="Search partners" aria-label="Search partners" className="pl-9" />
          </form>
          {shown.length === 0 ? (
            <p className="py-10 text-center text-sm text-on-surface-variant">{rows.length ? "No partner matches." : "No rewards yet."}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="[&>th]:whitespace-nowrap">
                  <TableHead>Partner</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>To approve</TableHead>
                  <TableHead>To pay</TableHead>
                  <TableHead>{admin ? "Paid (this year)" : "Paid"}</TableHead>
                  <TableHead>Rejected</TableHead>
                  {admin && <TableHead>Flags</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {shown.map((r) => (
                  <TableRow key={r.id} className="relative" data-partner={r.id}>
                    <TableCell className="font-medium text-on-surface">
                      <Link href={`/dashboard/rewards/${r.id}`} className="after:absolute after:inset-0 hover:underline">
                        {r.orgName}
                      </Link>
                    </TableCell>
                    <TableCell className="text-on-surface-variant">{r.type === "ORGANISATION" ? "Organisation" : "Individual"}</TableCell>
                    <TableCell><CountCell count={r.counts.PENDING} amount={r.money?.toApprove} /></TableCell>
                    <TableCell><CountCell count={r.counts.APPROVED} amount={r.money?.owed} /></TableCell>
                    <TableCell><CountCell count={r.counts.PAID} amount={r.money?.paidThisFy} /></TableCell>
                    <TableCell><CountCell count={r.counts.REJECTED} /></TableCell>
                    {admin && <TableCell><Flags row={r} /></TableCell>}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
