import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AddPartnerDialog } from "@/components/partners/add-partner-dialog";
import { requireStaff } from "@/lib/auth/session";
import { PARTNER_STATUS_BADGE_CLASSES, formatDate } from "@/lib/leads";
import { listPartners } from "@/lib/partners/onboarding";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = { invited: "Invited", active: "Active", disabled: "Turned off" };

export default async function PartnersPage() {
  await requireStaff();
  const partners = await listPartners();

  return (
    <div className="flex flex-1 flex-col gap-6 p-6 md:p-8">
      <div className="flex items-center gap-2">
        <SidebarTrigger />
      </div>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-heading-lg text-on-surface">Partners</h1>
          <p className="mt-1 text-sm text-on-surface-variant">
            Lead generators and organisations who send leads through LeadBridge · {partners.length} total
          </p>
        </div>
        <AddPartnerDialog />
      </div>

      <Card>
        <CardContent className="pt-6 md:pt-9">
          {partners.length === 0 ? (
            <p className="py-10 text-center text-sm text-on-surface-variant">
              No partners yet. Add the first one — they get an invite link to set a password.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="[&>th]:whitespace-nowrap">
                  <TableHead>Partner</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Logins</TableHead>
                  <TableHead className="text-right">Leads</TableHead>
                  <TableHead>API keys</TableHead>
                  <TableHead>Added</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {partners.map((p) => (
                  <TableRow key={p.id} className="relative">
                    <TableCell className="whitespace-nowrap font-medium text-on-surface">
                      <Link href={`/dashboard/partners/${p.id}`} className="after:absolute after:inset-0 hover:underline">
                        {p.orgName}
                      </Link>
                      <span className="block text-xs text-on-surface-variant">{p.contactEmail}</span>
                    </TableCell>
                    <TableCell>{p.type === "ORGANISATION" ? "Organisation" : "Individual"}{p.isOndc ? " · ONDC" : ""}</TableCell>
                    <TableCell>
                      <Badge className={cn("border-transparent", PARTNER_STATUS_BADGE_CLASSES[p.status])}>{STATUS_LABEL[p.status] ?? p.status}</Badge>
                    </TableCell>
                    <TableCell>{p.users.length}</TableCell>
                    <TableCell className="text-right tabular-nums">{p._count.leads}</TableCell>
                    <TableCell>{p.apiKeys.filter((k) => !k.revokedAt).length || "—"}</TableCell>
                    <TableCell className="whitespace-nowrap">{formatDate(p.createdAt.toISOString())}</TableCell>
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
