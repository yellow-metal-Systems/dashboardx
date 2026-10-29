import Link from "next/link";
import { Search } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requirePermission } from "@/lib/auth/session";
import { formatInr } from "@/lib/leads";
import { listRewardPartners, type PartnerRewardRow } from "@/lib/partners/rewards";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export const metadata = { title: "Rewards" };

// Even padding on every side. CardContent's default drops the top padding
// because it expects a CardHeader above it; these cards have none.
const PAD = "p-5 md:p-6";

function CountCell({ count, amount }: { count: number; amount?: number }) {
  if (count === 0) return <span className="text-on-surface-variant">—</span>;
  return (
    <span className="flex flex-col items-end">
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
  // "admin" here means may see amounts and act on rewards (rewards.manage).
  const access = await requirePermission("rewards.view");
  const admin = access.permissions.includes("rewards.manage");
  // Narrower than "admin": financial operators see amounts but can't change the rules.
  const editRules = access.permissions.includes("rewardRules.manage");
  const { rows, totals, awaiting } = await listRewardPartners(admin);
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
        <Card>
          <CardContent className={cn("flex flex-col divide-y divide-outline-variant", PAD)}>
            {[
              ["To approve", totals.toApprove],
              ["To pay", totals.owed],
              ["Paid this financial year", totals.paidThisFy],
            ].map(([label, value]) => (
              <div key={label as string} className="flex items-baseline justify-between gap-4 py-2 first:pt-0 last:pb-0">
                <span className="text-sm text-on-surface-variant">{label}</span>
                <span className="text-heading-sm tabular-nums text-on-surface">{formatInr(value as number)}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {editRules && (
        <p className="text-sm text-on-surface-variant">
          Reward rules (rates and the monthly bonus) are in{" "}
          <Link href="/dashboard/settings" className="text-link underline underline-offset-4 hover:text-link-hover">Settings</Link>.
        </p>
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
                  <Link href={`/dashboard/leads/${a.leadId}`} className="text-link underline underline-offset-4 hover:text-link-hover">{a.name}</Link> ({a.orgName})
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
                  <TableHead className="text-right">To approve</TableHead>
                  <TableHead className="text-right">To pay</TableHead>
                  <TableHead className="text-right">{admin ? "Paid (this year)" : "Paid"}</TableHead>
                  <TableHead className="text-right">Rejected</TableHead>
                  {admin && <TableHead>Flags</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {shown.map((r) => (
                  <TableRow key={r.id} className="relative" data-partner={r.id}>
                    <TableCell className="text-on-surface">
                      <Link href={`/dashboard/rewards/${r.id}`} className="after:absolute after:inset-0 hover:underline">
                        {r.orgName}
                      </Link>
                    </TableCell>
                    <TableCell className="font-semibold text-on-surface-variant">{r.type === "ORGANISATION" ? "Organisation" : "Individual"}</TableCell>
                    <TableCell className="text-right"><CountCell count={r.counts.PENDING} amount={r.money?.toApprove} /></TableCell>
                    <TableCell className="text-right"><CountCell count={r.counts.APPROVED} amount={r.money?.owed} /></TableCell>
                    <TableCell className="text-right"><CountCell count={r.counts.PAID} amount={r.money?.paidThisFy} /></TableCell>
                    <TableCell className="text-right"><CountCell count={r.counts.REJECTED} /></TableCell>
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
