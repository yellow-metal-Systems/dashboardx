import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AddPartnerDialog } from "@/components/partners/add-partner-dialog";
import { PendingApplications } from "@/components/partners/application-controls";
import { requirePermission } from "@/lib/auth/session";
import { PARTNER_STATUS_BADGE_CLASSES, formatDate, formatDateTime } from "@/lib/leads";
import { listPartners } from "@/lib/partners/onboarding";
import {
  APPLICATION_STATUSES,
  countPendingApplications,
  listApplications,
  type ApplicationStatus,
} from "@/lib/partners/applications";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = { invited: "Invited", active: "Active", disabled: "Turned off" };
const APPLICATION_LABEL: Record<ApplicationStatus, string> = { PENDING: "Pending", APPROVED: "Approved", REJECTED: "Rejected" };

function Tab({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "inline-flex h-8 items-center gap-2 rounded-full px-3 text-sm font-bold",
        active ? "bg-raised shadow-e1" : "text-on-surface-variant"
      )}
    >
      {children}
    </Link>
  );
}

export default async function PartnersPage({ searchParams }: { searchParams: { tab?: string; status?: string } }) {
  await requirePermission("partners.view");
  const onApplications = searchParams.tab === "applications";
  const appStatus: ApplicationStatus = (APPLICATION_STATUSES as readonly string[]).includes(searchParams.status ?? "")
    ? (searchParams.status as ApplicationStatus)
    : "PENDING";

  const [partners, pendingCount, applications] = await Promise.all([
    onApplications ? null : listPartners(),
    countPendingApplications(),
    onApplications ? listApplications(appStatus) : null,
  ]);

  return (
    <div className="flex flex-1 flex-col gap-6 p-6 md:p-8">
      <div className="flex items-center gap-2">
        <SidebarTrigger />
      </div>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-heading-lg text-on-surface">Partners</h1>
          <p className="mt-1 text-sm text-on-surface-variant">
            Lead generators and organisations who send leads through LeadBridge
            {partners && ` · ${partners.length} total`}
          </p>
        </div>
        <AddPartnerDialog />
      </div>

      <nav aria-label="Partners sections" className="flex w-fit gap-1 rounded-full bg-surface-container-low p-1">
        <Tab href="/dashboard/partners" active={!onApplications}>Partners</Tab>
        <Tab href="/dashboard/partners?tab=applications" active={onApplications}>
          Applications
          {pendingCount > 0 && (
            <Badge variant="pending" data-pending-applications>{pendingCount}</Badge>
          )}
        </Tab>
      </nav>

      {applications ? (
        <Card>
          <CardContent className="flex flex-col gap-4 pt-6 md:pt-9">
            <div className="flex flex-wrap gap-3 text-sm">
              {APPLICATION_STATUSES.map((s) => (
                <Link
                  key={s}
                  href={`/dashboard/partners?tab=applications&status=${s}`}
                  aria-current={s === appStatus ? "page" : undefined}
                  className={cn(
                    "underline-offset-4 hover:underline",
                    s === appStatus ? "font-bold text-on-surface underline" : "text-on-surface-variant"
                  )}
                >
                  {APPLICATION_LABEL[s]}
                </Link>
              ))}
            </div>

            {appStatus === "PENDING" ? (
              <PendingApplications
                rows={applications.map((a) => ({
                  id: a.id,
                  name: a.name,
                  mobile: a.mobile,
                  town: a.town,
                  createdAt: a.createdAt.toISOString(),
                }))}
              />
            ) : applications.length === 0 ? (
              <p className="py-10 text-center text-sm text-on-surface-variant">
                No {APPLICATION_LABEL[appStatus].toLowerCase()} applications yet.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="[&>th]:whitespace-nowrap">
                    <TableHead>Applicant</TableHead>
                    <TableHead>Town</TableHead>
                    <TableHead>Applied</TableHead>
                    <TableHead>Reviewed</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {applications.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell className="font-medium text-on-surface">
                        {a.partnerId ? (
                          <Link href={`/dashboard/partners/${a.partnerId}`} className="hover:underline">{a.name}</Link>
                        ) : (
                          a.name
                        )}
                        <span className="block text-xs font-normal text-on-surface-variant">{a.mobile}</span>
                      </TableCell>
                      <TableCell>{a.town}</TableCell>
                      <TableCell className="whitespace-nowrap">{formatDateTime(a.createdAt.toISOString())}</TableCell>
                      <TableCell className="text-sm">
                        {a.reviewedAt && formatDate(a.reviewedAt.toISOString())}
                        {a.reviewedBy && <span className="text-on-surface-variant"> by {a.reviewedBy}</span>}
                        {a.rejectReason && <span className="block text-xs text-on-surface-variant">“{a.rejectReason}”</span>}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="pt-6 md:pt-9">
            {partners!.length === 0 ? (
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
                    <TableHead>Users</TableHead>
                    <TableHead className="text-right">Leads</TableHead>
                    <TableHead>API keys</TableHead>
                    <TableHead>Added</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {partners!.map((p) => (
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
      )}
    </div>
  );
}
